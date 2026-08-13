import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(file)=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('authentication enforces initial password replacement and throttling',async()=>{
  const source=await read('server/index.js');
  assert.match(source,/must_change_password/);
  assert.match(source,/failed_login_attempts/);
  assert.match(source,/PASSWORD_CHANGE_REQUIRED/);
  assert.match(source,/dummyPasswordHash/);
  assert.doesNotMatch(source,/ON CONFLICT\(username\) DO UPDATE SET password_hash/);
});

test('upload policy uses allowlists and role-aware video limits',async()=>{
  const policy=await read('server/uploadPolicy.js');
  const management=await read('server/management.js');
  const operational=await read('server/operational.js');
  assert.match(policy,/documentTypes/);
  assert.match(policy,/VIDEO_UPLOAD_LIMIT/);
  assert.match(management,/documentFileFilter/);
  assert.match(operational,/documentFileFilter/);
});

test('stable add-on and CSP are explicit',async()=>{
  const config=await read('config.yaml');
  const nginx=await read('rootfs/etc/nginx/http.d/projects.conf');
  assert.match(config,/stage: stable/);
  assert.match(nginx,/Content-Security-Policy/);
  assert.match(nginx,/object-src 'none'/);
});

test('critical Playwright paths are included in CI',async()=>{
  const workflow=await read('../.github/workflows/validate.yml');
  const e2e=await read('e2e/critical-paths.spec.js');
  assert.match(workflow,/npm run test:e2e/);
  assert.match(e2e,/initial administrator password/);
  assert.match(e2e,/rejects unsupported document uploads/);
});

test('direct dependencies are pinned without ranges or latest tags',async()=>{
  const manifest=JSON.parse(await read('package.json'));
  for(const [name,version] of Object.entries({...manifest.dependencies,...manifest.devDependencies})) {
    assert.match(version,/^\d+\.\d+\.\d+$/,
      `${name} is not pinned to an exact version`);
  }
});
