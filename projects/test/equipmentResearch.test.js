import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveEquipment,equipmentPrompt,questionIntent,safeWebUrl,publicIpv4,extractGrounding,fetchPublicAsset} from '../server/equipmentResearch.js';
import {generateProviderText} from '../server/ai.js';

test('Hebrew project question resolves exact switch models locally and deduplicates repeated equipment',async()=>{
  const queries=[];
  const pool={query:async(sql,args)=>{queries.push([sql,args]);return {rows:sql.includes('FROM projects')?[{id:'p1',name:'וילה לוי',client:'משפחת לוי'}]:[
    {id:1,name:'מפסק חדר',manufacturer:'Maker',model:'M1',system_name:'KNX'},
    {id:1,name:'מפסק חדר',manufacturer:'Maker',model:'M1',system_name:'KNX'},
    {id:2,name:'ספק כוח',manufacturer:'Maker',model:'PS1',system_name:'KNX'},
  ]};}};
  const result=await resolveEquipment(pool,{question:'מה המידות של המפסקים בפרויקט של לוי?'});
  assert.equal(result.project.id,'p1');assert.equal(result.products.length,1);assert.equal(result.products[0].model,'M1');
  assert.deepEqual(queries[1][1],['p1']);
  const prompt=equipmentPrompt(result.products[0],questionIntent('מה המידות?'));
  assert.doesNotMatch(prompt,/לוי|p1|חדר/);assert.match(prompt,/dimensions/);
});

test('ambiguous project name asks for selection before reading equipment',async()=>{
  let calls=0;const pool={query:async()=>{calls++;return{rows:[{id:'a',name:'בית לוי'},{id:'b',name:'וילה לוי'}]};}};
  const result=await resolveEquipment(pool,{question:'מידות מפסקים בפרויקט של לוי'});
  assert.equal(calls,1);assert.equal(result.projects.length,2);assert.equal(result.products.length,0);
});

test('missing manufacturer/model stays missing rather than interpreting the catalog name',async()=>{
  const pool={query:async sql=>({rows:sql.includes('FROM projects')?[{id:'a',name:'לוי'}]:[{id:1,name:'מפסק גדול',manufacturer:'',model:''}]})};
  const result=await resolveEquipment(pool,{question:'מידות המפסקים בפרויקט לוי'});
  assert.equal(result.products[0].model,'');assert.equal(result.products[0].manufacturer,'');
});

test('public reference fetching rejects local URLs and private, rebinding and reserved addresses',async()=>{
  for(const url of ['file:///etc/passwd','http://maker.com/a','https://localhost/x','https://127.0.0.1','https://maker.local/a','https://u:p@maker.com','https://maker.com:8443'])assert.equal(safeWebUrl(url),'');
  for(const ip of ['127.0.0.1','10.1.2.3','172.16.0.2','192.168.1.1','169.254.169.254','100.64.0.1','198.18.0.2','::1','192.0.2.1','224.0.0.1'])assert.equal(publicIpv4(ip),false,ip);
  assert.equal(publicIpv4('8.8.8.8'),true);
  await assert.rejects(fetchPublicAsset('https://127.0.0.1/'),/Unsafe/);
});

test('OpenAI research requests actual required web search and exposes clickable citation metadata',async t=>{
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});let grounding,usage;
  globalThis.fetch=async(_url,options)=>{const body=JSON.parse(options.body);assert.equal(body.tools[0].type,'web_search');assert.equal(body.tool_choice,'required');assert.equal(body.max_output_tokens,2200);return new Response(JSON.stringify({output:[{type:'message',content:[{text:'Width 80 mm.',annotations:[{type:'url_citation',url:'https://manufacturer.com/product',title:'Product',start_index:0,end_index:12}]}]}],usage:{input_tokens:100,output_tokens:20}}));};
  const answer=await generateProviderText('openai','gpt-4.1-mini','test','public product',{webSearch:true,onGrounding:g=>{grounding=g;},onUsage:u=>{usage=u;}});
  assert.equal(answer,'Width 80 mm.');assert.equal(grounding.sources[0].url,'https://manufacturer.com/product');assert.deepEqual(grounding.citations,[{end:12,source:0}]);assert.equal(usage.inputTokens,100);
});

test('ungrounded answers are rejected after recording usage, never presented as verified specs',async t=>{
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});let recorded=false;
  globalThis.fetch=async()=>new Response(JSON.stringify({output_text:'Probably 80mm'}));
  await assert.rejects(generateProviderText('openai','test','test','test',{webSearch:true,onUsage:()=>{recorded=true;}}),/Missing web grounding/);
  assert.equal(recorded,true);
});

test('Gemini research uses Google search and preserves grounding supports and search suggestions',async t=>{
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});let grounding;
  globalThis.fetch=async(_url,options)=>{assert.deepEqual(JSON.parse(options.body).tools,[{google_search:{}}]);return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'80 mm'}]},groundingMetadata:{groundingChunks:[{web:{uri:'https://maker.com/product',title:'Maker'}}],groundingSupports:[{segment:{endIndex:5},groundingChunkIndices:[0]}],searchEntryPoint:{renderedContent:'<div>Search suggestions</div>'}}}]}));};
  await generateProviderText('gemini','test','test','test',{webSearch:true,onGrounding:g=>{grounding=g;}});
  assert.equal(grounding.citations[0].end,5);assert.match(grounding.suggestions,/Search suggestions/);
  assert.equal(extractGrounding('openai',{output:[{content:[{text:'abc',annotations:[{type:'url_citation',url:'javascript:alert(1)',end_index:3}]}]}]},'abc').sources.length,0);
});

test('Gemini Hebrew and emoji citation byte offsets map to the matching rendered text part',()=>{
  const first='כותרת: ',last='רוחב 80 מ״מ 🔎';
  const result=extractGrounding('gemini',{candidates:[{content:{parts:[{text:first},{text:last}]},groundingMetadata:{groundingChunks:[{web:{uri:'https://maker.com/a'}}],groundingSupports:[{segment:{partIndex:1,endIndex:Buffer.byteLength(last)},groundingChunkIndices:[0]}]}}]},first+last);
  assert.equal(result.citations[0].end,(first+last).length);
});
