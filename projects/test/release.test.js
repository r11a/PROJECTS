import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('release version stays synchronized across package and Home Assistant metadata', async () => {
  const packageJson=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  const [config,docker]=await Promise.all([
    readFile(new URL('../config.yaml',import.meta.url),'utf8'),
    readFile(new URL('../Dockerfile',import.meta.url),'utf8'),
  ]);
  assert.match(config,new RegExp(`^version: "${packageJson.version.replaceAll('.','\\.')}"$`,'m'));
  assert.match(docker,new RegExp(`io\\.hass\\.version="${packageJson.version.replaceAll('.','\\.')}"`));
});

test('all AI data dependencies exist in ordered migrations', async () => {
  const migrations=await Promise.all([
    '001_initial.sql','003_operational_core.sql','005_management_foundation.sql','006_project_operations.sql',
    '010_project_workflow_fields.sql','013_ai_providers.sql','014_project_serial_codes.sql','015_ai_usage.sql','016_ai_chat_jobs.sql',
  ].map((name)=>readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8')));
  const schema=migrations.join('\n');
  for (const token of ['CREATE TABLE IF NOT EXISTS projects','CREATE TABLE IF NOT EXISTS clients','CREATE TABLE IF NOT EXISTS tasks','CREATE TABLE IF NOT EXISTS professionals','CREATE TABLE IF NOT EXISTS equipment_catalog','CREATE TABLE IF NOT EXISTS project_equipment','CREATE TABLE IF NOT EXISTS ai_provider_settings','CREATE TABLE IF NOT EXISTS ai_usage_log','CREATE TABLE IF NOT EXISTS ai_chat_jobs','priority_customer_number','assignee_professional_id','serial_code','parent_id','item_type','quantity','company_name','job_title','affiliation','project_size','contractor_progress']) {
    assert.ok(schema.includes(token),`missing AI schema dependency: ${token}`);
  }
});
