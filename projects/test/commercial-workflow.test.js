import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(file)=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('commercial workflow migration defines permissions and project metadata',async()=>{
  const migration=await read('migrations/029_commercial_workflow.sql');
  for(const column of ['permissions','finance_access','completed_at','project_icon','project_color','installation_lead_professional_id','finance_breakdown','priority_sku']) {
    assert.match(migration,new RegExp(`\\b${column}\\b`),`missing ${column}`);
  }
  assert.match(migration,/supervisor/);
  assert.match(migration,/custom/);
});

test('finance restrictions are enforced by the API and not only hidden in the UI',async()=>{
  const server=await read('server/index.js');
  const operations=await read('server/operations.js');
  assert.match(server,/function projectForUser/);
  assert.match(server,/financeAccess !== false/);
  assert.match(operations,/request\.user\.financeAccess === false \? \[\] : payments\.rows/);
  assert.match(operations,/restricted:true/);
});

test('mobile forms prevent focus zoom and document viewers use the dynamic viewport',async()=>{
  const styles=await read('src/commercial-ui.css');
  assert.match(styles,/input,select,textarea\{font-size:16px!important\}/);
  assert.match(styles,/100dvh/);
});

test('add-on entry document is never cached across upgrades',async()=>{
  const nginx=await read('rootfs/etc/nginx/http.d/projects.conf');
  assert.match(nginx,/Cache-Control "no-store, no-cache, must-revalidate, max-age=0"/);
  assert.match(nginx,/location \/assets\//);
  assert.match(nginx,/immutable/);
});

test('release versions stay synchronized',async()=>{
  const manifest=JSON.parse(await read('package.json'));
  const config=await read('config.yaml');
  const docker=await read('Dockerfile');
  const escapedVersion=manifest.version.replaceAll('.', '\\.');
  assert.match(config,new RegExp(`version: "${escapedVersion}"`));
  assert.match(docker,new RegExp(`io\\.hass\\.version="${escapedVersion}"`));
});

test('catalog colors inherit from the system type and commercial layouts stay isolated',async()=>{
  const catalog=await read('src/MasterDataWorkspace.jsx');
  const app=await read('src/App.jsx');
  const workspaces=await read('src/Workspaces.jsx');
  const styles=await read('src/commercial-ui-extra.css');

  assert.match(catalog,/const effectiveColor = inheritedColor \|\| item\.color \|\| "#6957df"/);
  assert.match(catalog,/renderItem\(system, categoryColor\)/);
  assert.match(catalog,/renderItem\(component, categoryColor\)/);
  assert.match(app,/className="admin-user-row"/);
  assert.match(styles,/\.admin-user-row\s*\{/);
  assert.doesNotMatch(styles,/^\.user-card\s*\{/m);
  assert.match(workspaces,/finance-dashboard-grid-single/);
  assert.doesNotMatch(workspaces,/finance-project-summary/);
});

test('fresh add-on demo seed satisfies required project appearance columns',async()=>{
  const server=await read('server/index.js');
  assert.match(server,/projectIcon:'', projectColor:'#6957df'/);
});
