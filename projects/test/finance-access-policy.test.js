import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(file)=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('finance access requires both the account switch and a finance permission',async()=>{
  const source=await read('server/index.js');
  assert.match(source,/function canViewFinanceUser\(user\)/);
  assert.match(source,/\(user\.financeAccess\?\?user\.finance_access\)===false/);
  assert.match(source,/user\.permissions\?\.finance/);
  assert.match(source,/resource==='finance'&&!canViewFinanceUser\(user\)/);
  assert.doesNotMatch(source,/resource==='finance'&&user\.financeAccess===false\)return 'none';if\(user\.role==='admin'/);
});

test('finance denial is enforced on serialized API responses and project rows',async()=>{
  const source=await read('server/index.js');
  assert.match(source,/enforceFinanceResponsePolicy/);
  assert.match(source,/projectLike&&\(key==='value'\|\|key==='paid'\)/);
  for(const key of ['financeProjects','payments','priceImpact','estimatedCost','monthlyBudgetUsd']) {
    assert.match(source,new RegExp(`['"]${key}['"]`),`missing response redaction for ${key}`);
  }
});

test('finance widgets and project balances are hidden in the interface',async()=>{
  const app=await read('src/App.jsx');
  const reports=await read('src/Workspaces.jsx');
  assert.match(app,/userCanAccess\(user,"finance"\)/);
  assert.match(app,/\{canViewFinance&&<th>[\s\S]{0,500}?toggleProjectSort\("balance"\)/);
  assert.match(app,/\{canViewFinance&&<td>[\s\S]{0,300}?money-cell/);
  assert.match(reports,/canViewFinance&&<option value="finance">/);
  assert.match(reports,/canViewFinance&&<li>/);
});
