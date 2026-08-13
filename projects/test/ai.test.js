import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MODEL_RATES,
  buildChatContext,
  buildLocalChatAnswer,
  chatPrompt,
  generateProviderText,
  parseInsightResponse,
  providerError,
  testProvider,
} from '../server/ai.js';

test('project overview SQL filters AVG before ROUND', async () => {
  const queries=[];
  const pool={ query:async (sql)=>{ queries.push(String(sql));return { rows:[] }; } };
  const context=await buildChatContext(pool,'project client task payment manager system');
  assert.deepEqual(Object.keys(context),['overview','projects','clients','tasks','finance','professionals','projectSystems','systems']);
  assert.match(queries[0],/ROUND\(AVG\(progress\) FILTER \(WHERE archived_at IS NULL\)\)/);
  assert.doesNotMatch(queries[0],/ROUND\(AVG\(progress\)\) FILTER/);
  assert.equal(queries.length,8);
  assert.match(queries[6],/jsonb_array_elements_text/);
});

test('software help uses the product guide without loading unrelated project records', async () => {
  const queries=[];
  const pool={ query:async (sql)=>{ queries.push(String(sql));return { rows:[] }; } };
  const context=await buildChatContext(pool,'איך יוצרים פרויקט חדש?');
  assert.deepEqual(Object.keys(context),['overview','help']);
  assert.equal(queries.length,1);
  assert.match(context.help.createProject.join(' '),/שלב 1/);
  assert.match(chatPrompt({ question:'איך יוצרים פרויקט חדש?',history:[],context }),/פרויקט חדש/);
});

test('local chat answers common help and live management questions without a provider', async () => {
  const pool={ query:async (sql)=>{
    const text=String(sql);
    if (text.includes('SUM(value-paid)')) return { rows:[{ outstanding:'484600' }] };
    throw new Error(`unexpected query: ${text}`);
  } };
  assert.match(await buildLocalChatAnswer(pool,'איך יוצרים פרויקט חדש?'),/פרויקט חדש/);
  assert.match(await buildLocalChatAnswer(pool,'מה היתרה הכוללת לגבייה?'),/484,600/);
  assert.equal(await buildLocalChatAnswer(pool,'כתוב לי ניתוח חופשי'),'');
});

test('local chat covers the operational questions that previously lost their jobs', async () => {
  const pool={ query:async (sql)=>{
    const text=String(sql).replace(/\s+/g,' ');
    if (text.includes('GROUP BY p.id HAVING')) return { rows:[{ name:'בית כהן',stage:'installation_b',progress:65,health:60,flag:'דחוף',overdue:2 }] };
    if (text.includes("stage IN ('installation_a'")) return { rows:[{ name:'בית כהן',stage:'installation_b',progress:65,manager:'רונן' }] };
    if (text.includes('COUNT(*)::int active')) return { rows:[{ active:7,progress:54,outstanding:'484600' }] };
    if (text.includes('GROUP BY stage')) return { rows:[{ stage:'installation_b',count:2 }] };
    if (text.includes("COUNT(*) FILTER (WHERE status NOT IN")) return { rows:[{ open:5,overdue:2 }] };
    throw new Error(`unexpected query: ${text}`);
  } };
  assert.match(await buildLocalChatAnswer(pool,'אלו פרויקטים דורשים תשומת לב?'),/בית כהן.*2 משימות באיחור/s);
  assert.match(await buildLocalChatAnswer(pool,'אילו פרויקטים נמצאים בשלב התקנות?'),/התקנות שלב ב׳/);
  const snapshot=await buildLocalChatAnswer(pool,'תן לי תמונת מצב של הפרויקטים הפעילים');
  assert.match(snapshot,/7 פרויקטים פעילים/);
  assert.match(snapshot,/484,600/);
});

test('context routing only loads the requested domain plus overview', async () => {
  const queries=[];
  const pool={ query:async (sql)=>{ queries.push(String(sql));return { rows:[] }; } };
  const context=await buildChatContext(pool,'Which tasks are overdue?');
  assert.deepEqual(Object.keys(context),['overview','tasks']);
  assert.equal(queries.length,2);
});

test('chat history excludes UI errors and remains bounded', () => {
  const prompt=chatPrompt({
    question:'status',
    context:{ overview:[] },
    history:[
      { role:'error',text:'secret-error' },
      ...Array.from({ length:8 },(_,index)=>({ role:index%2?'assistant':'user',text:`message-${index}` })),
    ],
  });
  assert.doesNotMatch(prompt,/secret-error/);
  assert.doesNotMatch(prompt,/message-0|message-1/);
  assert.match(prompt,/message-7/);
});

test('Gemini response extraction records usage and cost', async (context) => {
  const originalFetch=globalThis.fetch;
  context.after(()=>{ globalThis.fetch=originalFetch; });
  globalThis.fetch=async ()=>new Response(JSON.stringify({
    candidates:[{ content:{ parts:[{ text:'תשובה תקינה' }] } }],
    usageMetadata:{ promptTokenCount:100,candidatesTokenCount:20,totalTokenCount:120 },
  }),{ status:200,headers:{ 'content-type':'application/json' } });
  let usage;
  const text=await generateProviderText('gemini','gemini-3.5-flash-lite','key','prompt',{ onUsage:async (value)=>{ usage=value; } });
  assert.equal(text,'תשובה תקינה');
  assert.equal(usage.totalTokens,120);
  assert.equal(usage.estimatedCostUsd,(100*MODEL_RATES['gemini-3.5-flash-lite'].input+20*MODEL_RATES['gemini-3.5-flash-lite'].output)/1_000_000);
});

test('OpenAI response extraction supports the raw Responses API shape', async (context) => {
  const originalFetch=globalThis.fetch;
  context.after(()=>{ globalThis.fetch=originalFetch; });
  globalThis.fetch=async ()=>new Response(JSON.stringify({
    output:[{ content:[{ type:'output_text',text:'OpenAI answer' }] }],
    usage:{ input_tokens:12,output_tokens:7,total_tokens:19 },
  }),{ status:200,headers:{ 'content-type':'application/json' } });
  assert.equal(await generateProviderText('openai','gpt-5.6-luna','key','prompt'),'OpenAI answer');
});

test('provider test rejects a successful but empty response', async (context) => {
  const originalFetch=globalThis.fetch;
  context.after(()=>{ globalThis.fetch=originalFetch; });
  globalThis.fetch=async ()=>new Response(JSON.stringify({ candidates:[{ finishReason:'STOP',content:{ parts:[] } }] }),{ status:200 });
  await assert.rejects(()=>testProvider('gemini','gemini-3.5-flash-lite','key'),/תשובה ריקה|לא השלים/);
});

test('provider errors distinguish invalid keys, quota and regional billing', () => {
  assert.match(providerError('gemini',400,{ error:{ message:'API key not valid',details:[{ reason:'API_KEY_INVALID' }] } }),/אינו תקין/);
  assert.match(providerError('gemini',429,{ error:{ message:'RESOURCE_EXHAUSTED' } }),/מכסה/);
  assert.match(providerError('gemini',400,{ error:{ status:'FAILED_PRECONDITION' } }),/אינו מורשה/);
  assert.match(providerError('openai',404,{ error:{ message:'model_not_found' } }),/אינו זמין/);
});

test('insight JSON is cleaned, validated and limited', () => {
  const parsed=parseInsightResponse('```json\n{"summary":"תקין","suggestions":[{"tone":"warning","title":"בדיקה","text":"פעולה","target":"tasks"}]}\n```');
  assert.equal(parsed.summary,'תקין');
  assert.deepEqual(parsed.suggestions,[{ tone:'warning',title:'בדיקה',text:'פעולה',target:'tasks' }]);
  assert.throws(()=>parseInsightResponse('{"summary":"empty","suggestions":[]}'),/usable insights/);
});
