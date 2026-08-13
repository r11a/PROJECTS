import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { createAiRouter } from '../server/ai.js';

class AiPool {
  constructor() {
    this.global={ activeProvider:'gemini',monthlyBudgetUsd:10,readOnly:true };
    this.providers=[];
    this.usage=[];
  }
  async query(sql,params=[]) {
    const text=String(sql).replace(/\s+/g,' ').trim();
    if (text.includes("SELECT value FROM app_settings WHERE key='ai'")) return { rows:[{ value:this.global }] };
    if (text.startsWith('SELECT * FROM ai_provider_settings')) return { rows:this.providers };
    if (text.startsWith('SELECT provider,enabled,model,api_key_encrypted FROM ai_provider_settings')) return { rows:this.providers };
    if (text.startsWith('SELECT api_key_encrypted FROM ai_provider_settings')) return { rows:this.providers.filter((item)=>item.provider===params[0]) };
    if (text.startsWith('SELECT model,api_key_encrypted FROM ai_provider_settings')) return { rows:this.providers.filter((item)=>item.provider===params[0]) };
    if (text.startsWith('INSERT INTO ai_provider_settings')) {
      const [provider,enabled,model,api_key_encrypted]=params;
      const current=this.providers.find((item)=>item.provider===provider);
      const value={ ...(current || {}),provider,enabled,model,api_key_encrypted,last_tested_at:null,last_test_status:null,last_test_error:'' };
      if (current) Object.assign(current,value); else this.providers.push(value);
      return { rows:[] };
    }
    if (text.startsWith("INSERT INTO app_settings(key,value,updated_by) VALUES('ai'")) { this.global=JSON.parse(params[0]);return { rows:[] }; }
    if (text.startsWith('UPDATE ai_provider_settings SET last_tested_at')) {
      const provider=params[0];const current=this.providers.find((item)=>item.provider===provider);
      if (current) { current.last_tested_at=new Date();current.last_test_status=text.includes("'success'")?'success':'error';current.last_test_error=params[1] || ''; }
      return { rows:[] };
    }
    if (text.startsWith('INSERT INTO ai_usage_log')) { this.usage.push(params);return { rows:[] }; }
    if (text.startsWith('SELECT COALESCE(SUM(estimated_cost_usd),0)::numeric spent')) return { rows:[{ spent:this.usage.reduce((sum,item)=>sum+Number(item[7] || 0),0) }] };
    return { rows:[] };
  }
}

test('AI router completes settings, provider test, async chat polling and usage logging', async (context) => {
  const dataDir=await mkdtemp(path.join(tmpdir(),'projects-ai-test-'));
  context.after(()=>rm(dataDir,{ recursive:true,force:true }));
  const pool=new AiPool();
  const authenticate=(request,_response,next)=>{ request.user={ id:7,role:'admin',displayName:'Test Admin' };next(); };
  const requireRoles=()=> (_request,_response,next)=>next();
  const router=await createAiRouter({ pool,authenticate,requireRoles,audit:async ()=>{},dataDir });
  const app=express();
  app.use(express.json());
  app.use('/api',router);
  const server=app.listen(0,'127.0.0.1');
  await new Promise((resolve)=>server.once('listening',resolve));
  context.after(()=>new Promise((resolve)=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}/api`;
  const originalFetch=globalThis.fetch;
  context.after(()=>{ globalThis.fetch=originalFetch; });
  globalThis.fetch=async (url,options={}) => {
    if (String(url).startsWith(base)) return originalFetch(url,options);
    const body=JSON.parse(options.body);
    const prompt=body.contents?.[0]?.parts?.[0]?.text || body.input || '';
    const answer=prompt.includes('Reply with exactly OK') ? 'OK' : 'מצב הגבייה תקין';
    return new Response(JSON.stringify({ candidates:[{ content:{ parts:[{ text:answer }] },finishReason:'STOP' }],usageMetadata:{ promptTokenCount:20,candidatesTokenCount:5,totalTokenCount:25 } }),{ status:200,headers:{ 'content-type':'application/json' } });
  };

  const settingsResponse=await originalFetch(`${base}/ai/settings`,{ method:'PATCH',headers:{ 'content-type':'application/json' },body:JSON.stringify({ provider:'gemini',activeProvider:'gemini',model:'gemini-3.5-flash-lite',enabled:true,apiKey:'test-key',monthlyBudgetUsd:10,readOnly:true }) });
  assert.equal(settingsResponse.status,200);
  assert.equal((await settingsResponse.json()).providers.gemini.configured,true);

  const testResponse=await originalFetch(`${base}/ai/providers/gemini/test`,{ method:'POST',headers:{ 'content-type':'application/json' },body:'{}' });
  assert.equal(testResponse.status,200);

  const createResponse=await originalFetch(`${base}/ai/chat`,{ method:'POST',headers:{ 'content-type':'application/json' },body:JSON.stringify({ question:'סכם את מצב הגבייה',history:[] }) });
  assert.equal(createResponse.status,202);
  const { jobId }=await createResponse.json();
  let result;
  for (let attempt=0;attempt<20;attempt+=1) {
    const poll=await originalFetch(`${base}/ai/chat/${jobId}`);
    result=await poll.json();
    if (poll.status===200) break;
    await new Promise((resolve)=>setTimeout(resolve,10));
  }
  assert.equal(result.answer,'מצב הגבייה תקין');
  assert.equal(result.provider,'gemini');
  assert.equal(pool.usage.length,1);
  assert.equal(pool.usage[0][3],'chat');

  pool.global.monthlyBudgetUsd=0.000001;
  const budgetResponse=await originalFetch(`${base}/ai/chat`,{ method:'POST',headers:{ 'content-type':'application/json' },body:JSON.stringify({ question:'שאלה נוספת',history:[] }) });
  assert.equal(budgetResponse.status,402);
  assert.match((await budgetResponse.json()).error,/תקציב/);
});
