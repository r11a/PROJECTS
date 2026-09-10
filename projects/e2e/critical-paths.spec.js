import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {jsPDF} from 'jspdf';

const hardenedPassword = 'Projects-CI-2026!';

async function closeBlockingAlerts(page) {
  const alertBackdrop = page.locator('.alert-backdrop');
  if (await alertBackdrop.isVisible().catch(() => false)) {
    await alertBackdrop.locator('.alert-center > header button').click();
    await expect(alertBackdrop).toBeHidden();
  }
}

async function webLogin(page, password = hardenedPassword) {
  await page.context().clearCookies();
  await page.goto('/');
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill(password);
  const insightsResponse = page.waitForResponse((candidate) => candidate.url().includes('/api/ai/insights'));
  const [response] = await Promise.all([
    page.waitForResponse((candidate) => candidate.url().includes('/api/auth/login') && candidate.request().method() === 'POST'),
    page.locator('form button[type="submit"], form button').last().click(),
  ]);
  expect(response.ok()).toBeTruthy();
  await expect(page.locator('.sidebar')).toBeVisible();
  await insightsResponse;
  await closeBlockingAlerts(page);
}

test.describe.serial('PROJECTS critical paths', () => {
  test('forces replacement of the initial administrator password', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await page.locator('input[autocomplete="username"]').fill('admin');
    await page.locator('input[autocomplete="current-password"]').fill('change-me-now');
    const [loginResponse] = await Promise.all([
      page.waitForResponse((candidate) => candidate.url().includes('/api/auth/login') && candidate.request().method() === 'POST'),
      page.locator('form button[type="submit"], form button').last().click(),
    ]);
    if (loginResponse.status() === 401) {
      // A retry runs against the same container after the first attempt may
      // already have replaced the password. Prove the hardened login instead.
      await page.locator('input[autocomplete="current-password"]').fill(hardenedPassword);
      const [retryResponse] = await Promise.all([
        page.waitForResponse((candidate) => candidate.url().includes('/api/auth/login') && candidate.request().method() === 'POST'),
        page.locator('form button[type="submit"], form button').last().click(),
      ]);
      expect(retryResponse.ok()).toBeTruthy();
      await expect(page.locator('.sidebar')).toBeVisible();
      return;
    }
    expect(loginResponse.ok()).toBeTruthy();
    expect((await loginResponse.json()).user.mustChangePassword).toBeTruthy();
    await expect(page.getByRole('heading', { name:'החלפת סיסמה ראשונית' })).toBeVisible();
    await page.locator('input[autocomplete="current-password"]').fill('change-me-now');
    const passwordInputs = page.locator('input[autocomplete="new-password"]');
    await passwordInputs.nth(0).fill(hardenedPassword);
    await passwordInputs.nth(1).fill(hardenedPassword);
    const [passwordResponse] = await Promise.all([
      page.waitForResponse((candidate) => candidate.url().includes('/api/auth/password') && candidate.request().method() === 'POST'),
      page.getByRole('button', { name: 'שמירת סיסמה' }).click(),
    ]);
    expect(passwordResponse.ok()).toBeTruthy();
    await expect(page.locator('.sidebar')).toBeVisible();
  });

  test('loads the authenticated dashboard and critical navigation', async ({ page }) => {
    await webLogin(page);
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.topbar')).toBeVisible();
    await page.getByRole('button', { name: /משימות/ }).first().click();
    await expect(page.locator('main')).toBeVisible();
  });

  test('creates a project from a template and exposes its generated tasks', async ({ page }) => {
    await webLogin(page);
    const clientsResponse = await page.request.get('/api/clients');
    const templatesResponse = await page.request.get('/api/project-templates');
    expect(clientsResponse.ok()).toBeTruthy();
    expect(templatesResponse.ok()).toBeTruthy();
    const clients = await clientsResponse.json();
    const templates = await templatesResponse.json();
    expect(clients.clients.length).toBeGreaterThan(0);
    expect(templates.templates.length).toBeGreaterThan(0);
    const name = `CI Hardened ${Date.now()}`;
    const created = await page.request.post('/api/projects', { data:{ name, clientId:clients.clients[0].id, templateId:templates.templates[0].id, startDate:'2026-08-01' } });
    expect(created.ok()).toBeTruthy();
    const project = (await created.json()).project;
    const tasksResponse = await page.request.get(`/api/operations/tasks?projectId=${encodeURIComponent(project.id)}`);
    expect(tasksResponse.ok()).toBeTruthy();
    const tasks = await tasksResponse.json();
    expect(tasks.tasks.length).toBeGreaterThan(0);
  });

  test('rejects unsupported document uploads', async ({ page }) => {
    await webLogin(page);
    const response = await page.request.post('/api/documents', { multipart:{ file:{ name:'unsafe.exe', mimeType:'application/octet-stream', buffer:Buffer.from('MZ') }, title:'unsafe' } });
    expect(response.status()).toBe(415);
  });

  test('prevents a stale task edit from overwriting the current database version', async ({ page }) => {
    await webLogin(page);
    const taskResponse = await page.request.get('/api/operations/tasks');
    expect(taskResponse.ok()).toBeTruthy();
    const task = (await taskResponse.json()).tasks.find(item => item.status === 'open' && !item.dependency_task_id);
    expect(task).toBeTruthy();
    expect(task.version).toBeGreaterThan(0);
    const title = `Versioned task ${Date.now()}`;
    const saved = await page.request.patch(`/api/operations/tasks/${task.id}`, { data:{title,expectedVersion:task.version} });
    expect(saved.ok()).toBeTruthy();
    expect((await saved.json()).task.version).toBeGreaterThan(task.version);
    const stale = await page.request.patch(`/api/operations/tasks/${task.id}`, { data:{title:'Stale title must not persist',expectedVersion:task.version} });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).code).toBe('EDIT_CONFLICT');
    const current = (await (await page.request.get('/api/operations/tasks')).json()).tasks.find(item => item.id === task.id);
    expect(current.title).toBe(title);
  });

  test('previews, edits and atomically imports a Priority XLSX order', async ({ page }) => {
    await webLogin(page);
    const clientsResponse = await page.request.get('/api/clients');
    const clients = (await clientsResponse.json()).clients;
    expect(clients.length).toBeGreaterThan(0);
    const created = await page.request.post('/api/projects', { data:{ name:`Priority E2E ${Date.now()}`,clientId:clients[0].id } });
    expect(created.ok()).toBeTruthy();
    const project = (await created.json()).project;
    const fixture = await readFile(new URL('../test/fixtures/priority-order-sanitized.xlsx', import.meta.url));
    const previewResponse = await page.request.post(`/api/projects/${encodeURIComponent(project.id)}/priority-orders/preview`, {
      multipart:{ file:{ name:'priority-order-sanitized.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:fixture } },
    });
    expect(previewResponse.ok()).toBeTruthy();
    const preview = await previewResponse.json();
    expect(preview.order.priorityOrderNumber).toBe('SO-TEST-001');
    expect(preview.lines.length).toBe(6);
    expect(preview.systems.length).toBeGreaterThan(0);
    const systemId = preview.systems[0].id;
    const lines = preview.lines.map((line) => ({
      sourceRow:line.sourceRow,include:line.classification!=='service',description:line.description,quantity:line.quantity,unit:line.unit,
      classification:line.classification,catalogItemId:line.catalogItem?.id||null,projectSystemId:systemId,
      createCatalogItem:['equipment','material'].includes(line.classification)&&!line.catalogItem,
      includeInEquipment:['equipment','material'].includes(line.classification),
      includeInReferenceHours:['installation_day','programming_day'].includes(line.classification),
      manufacturer:line.manufacturer||'',model:line.model||'',
    }));
    const equipment = lines.find((line) => line.classification === 'equipment');
    equipment.quantity = 4;
    equipment.description = 'ערכת אינטרקום שנערכה ב־E2E';
    const importResponse = await page.request.post(`/api/projects/${encodeURIComponent(project.id)}/priority-orders/import`, {
      data:{ previewId:preview.previewId,confirmCustomerMismatch:true,mode:'create',lines },
    });
    expect(importResponse.ok(), await importResponse.text()).toBeTruthy();
    const imported = (await importResponse.json()).import;
    expect(imported.selectedRows).toBe(5);
    expect(imported.installationHoursAdded).toBe(24);
    expect(imported.programmingHoursAdded).toBe(16);
    const detailResponse = await page.request.get(`/api/projects/${encodeURIComponent(project.id)}/priority-orders/${imported.orderId}`);
    expect(detailResponse.ok()).toBeTruthy();
    const detail = await detailResponse.json();
    expect(detail.lines.find((line) => line.prioritySku === 'EQ-001').quantity).toBe(4);
    expect(detail.lines.find((line) => line.prioritySku === 'EQ-001').description).toBe('ערכת אינטרקום שנערכה ב־E2E');
    const workspace = await (await page.request.get(`/api/projects/${encodeURIComponent(project.id)}/workspace`)).json();
    expect(workspace.equipment.length).toBeGreaterThanOrEqual(2);
    expect(workspace.priorityOrders.some((order) => order.id === imported.orderId)).toBeTruthy();
  });
  test('review follow-up, linked document deletion, drawing hours and manual equipment persist', async ({page})=>{
    await webLogin(page);
    const clients=await (await page.request.get('/api/clients')).json();
    const created=await page.request.post('/api/projects',{data:{name:`CI Workflow ${Date.now()}`,clientId:clients.clients[0].id}});
    expect(created.ok(),await created.text()).toBeTruthy();const project=(await created.json()).project;
    const base=`/api/projects/${encodeURIComponent(project.id)}`;
    const me=(await (await page.request.get('/api/auth/me')).json()).user;
    const reviewResult=await page.request.post(`${base}/site-reviews`,{data:{reviewDate:'2026-09-08',summary:'בדיקת תכנית',planUpdateRequired:true,hours:1}});
    expect(reviewResult.ok(),await reviewResult.text()).toBeTruthy();const review=(await reviewResult.json()).review;
    let workspace=await (await page.request.get(`${base}/workspace`)).json();
    const task=workspace.tasks.find(item=>String(item.id)===String(review.plan_update_task_id));
    expect(task.title).toBe('עדכון תכנית לאחר פגישה');expect(String(task.assignee_id)).toBe(String(me.id));
    expect(String(task.assignee_professional_id)).toBe(String(task.owner_professional_id));
    expect((new Date(task.due_date)-new Date(task.start_date))/86400000).toBe(7);
    const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jerusalem'}).format(new Date());
    expect(String(task.start_date).slice(0,10)).toBe(today);
    for(let i=0;i<2;i++){const edit=await page.request.patch(`${base}/site-reviews/${review.id}`,{data:{planUpdateRequired:true,summary:'עריכה ללא כפילות'}});expect(edit.ok(),await edit.text()).toBeTruthy();}
    workspace=await (await page.request.get(`${base}/workspace`)).json();expect(workspace.tasks.filter(item=>item.title===task.title)).toHaveLength(1);
    const upload=async(type,id)=>{const result=await page.request.post('/api/documents',{multipart:{projectId:project.id,title:`CI linked ${type}`,relatedEntityType:type,relatedEntityId:String(id),file:{name:'meeting.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD3sAAAAASUVORK5CYII=','base64')}}});expect(result.ok(),await result.text()).toBeTruthy();return (await result.json()).document;};
    const reviewFile=await upload('site_review',review.id),unrelated=await upload('',0);
    expect((await page.request.delete(`${base}/site-reviews/${review.id}`)).ok()).toBeTruthy();
    expect((await page.request.get(`/api/documents/${reviewFile.id}/download`)).status()).toBe(404);
    expect((await page.request.get(`/api/documents/${unrelated.id}/download`)).ok()).toBeTruthy();
    const meetingResult=await page.request.post(`${base}/meetings`,{data:{meetingAt:'2026-09-08T10:00',summary:'סיכום פגישה'}});expect(meetingResult.ok(),await meetingResult.text()).toBeTruthy();const meeting=(await meetingResult.json()).meeting;
    const meetingFile=await upload('meeting_summary',meeting.id);
    expect((await page.request.delete(`${base}/meetings/${meeting.id}`)).ok()).toBeTruthy();
    expect((await page.request.get(`/api/documents/${meetingFile.id}/download`)).status()).toBe(404);
    const hours=await page.request.post(`${base}/time-entries`,{data:{activityType:'drawing',workDate:'2026-09-08',hours:2}});expect(hours.ok(),await hours.text()).toBeTruthy();
    const catalog=await (await page.request.get('/api/equipment-catalog')).json(),system=catalog.items.find(item=>item.itemType==='system'&&item.active);
    const equipment=await page.request.post(`${base}/equipment`,{data:{manualName:'רכיב ידני לבדיקה',projectSystemId:system.id,quantity:2}});expect(equipment.ok(),await equipment.text()).toBeTruthy();
    const category=await page.request.patch(`${base}/system-board/${system.id}`,{data:{categoryName:'קטגוריה מעודכנת'}});expect(category.ok(),await category.text()).toBeTruthy();
    workspace=await (await page.request.get(`${base}/workspace`)).json();
    expect(workspace.equipment.some(item=>item.name==='רכיב ידני לבדיקה'&&item.system_type_name==='קטגוריה מעודכנת')).toBeTruthy();
    expect(workspace.timeEntries.some(item=>item.activity_type==='drawing'&&Number(item.hours)===2)).toBeTruthy();
    for(const legacy of [system,catalog.items.find(item=>item.itemType==='system_type'&&item.active)]){
      const added=await page.request.post(`${base}/equipment`,{data:{catalogItemId:legacy.id,quantity:1}});expect(added.ok(),await added.text()).toBeTruthy();
      const renamed=await page.request.patch(`${base}/system-board/${legacy.id}`,{data:{title:'ITEM שונה',categoryName:'שם קטגוריה נשמר',color:'#6957df',sortOrder:0,propagateColor:false}});expect(renamed.ok(),await renamed.text()).toBeTruthy();
      const refreshed=await (await page.request.get(`${base}/workspace`)).json();const saved=refreshed.equipment.find(item=>String(item.catalog_item_id)===String(legacy.id));expect(saved.system_name).toBe('ITEM שונה');expect(saved.system_type_name).toBe('שם קטגוריה נשמר');
    }
    expect(workspace.files.map(item=>String(item.id))).toEqual([String(unrelated.id)]);
    const manualRow=(await equipment.json()).equipment;
    const researchResponse=await page.request.post('/api/ai/chat/stream',{data:{question:`מה המידות של המפסקים בפרויקט ${project.name}?`,mode:'equipment',projectId:project.id,manufacturer:'Maker',model:'CI-M1',freeSearch:true}});
    expect(researchResponse.ok()).toBeTruthy();
    const researchAnswer=(await researchResponse.text()).split('\n\n').filter(block=>block.startsWith('data:')).map(block=>JSON.parse(block.slice(5))).find(item=>item.type==='answer');
    expect(researchAnswer.research.products[0].model).toBe('CI-M1');expect(researchAnswer.research.products[0].links).toHaveLength(4);
    const inherited=await page.request.post(`${base}/equipment`,{data:{catalogItemId:manualRow.catalog_item_id,quantity:1}});expect(inherited.ok(),await inherited.text()).toBeTruthy();
    const moved=await page.request.patch(`${base}/equipment/${manualRow.id}`,{data:{projectSystemId:catalog.items.find(item=>item.itemType==='system_type'&&item.active).id}});expect(moved.ok(),await moved.text()).toBeTruthy();
    const beforeDelete=await (await page.request.get(`${base}/workspace`)).json();
    const removed=beforeDelete.equipment.filter(item=>String(item.system_id)===String(system.id));
    const retained=beforeDelete.equipment.filter(item=>String(item.system_id)!==String(system.id));
    expect(removed.length).toBeGreaterThanOrEqual(2);
    expect(retained.length).toBeGreaterThan(0);
    expect((await page.request.delete(`${base}/system-board/${system.id}`)).ok()).toBeTruthy();
    const afterDelete=await (await page.request.get(`${base}/workspace`)).json();
    expect(afterDelete.equipment.map(item=>item.id).sort()).toEqual(retained.map(item=>item.id).sort());
    expect((await (await page.request.get('/api/equipment-catalog')).json()).items.some(item=>item.id===system.id)).toBeTruthy();
  });

  test('dynamic table import confirms before saving, reconciles changes and attaches each source file once',async({page})=>{
    await webLogin(page);
    const clients=await (await page.request.get('/api/clients')).json();
    const response=await page.request.post('/api/projects',{data:{name:`CI Dynamic ${Date.now()}`,clientId:clients.clients[0].id}});expect(response.ok()).toBeTruthy();const project=(await response.json()).project;
    const base=`/api/projects/${project.id}`;
    const csv=notes=>`${project.name}\nid,name,category,status,notes,location,manufacturer,model\nC1,Camera,CI Import Cameras,waiting,${notes},Lobby,Maker,M1\nC2,Camera,CI Import Cameras,installed,,Hall,Maker,M1`;
    const inspect=async text=>{const r=await page.request.post('/api/table-import/inspect',{multipart:{file:{name:'installations.csv',mimeType:'text/csv',buffer:Buffer.from(text)}}});expect(r.ok(),await r.text()).toBeTruthy();const p=await r.json();expect(p.detection.suggested).toBe(project.id);return p;};
    const compare=async(p,choices={})=>{const r=await page.request.post('/api/table-import/plan',{data:{previewId:p.previewId,projectId:project.id,configs:p.tables.map(t=>({...t,rows:undefined,due:'2026-09-15'})),choices}});expect(r.ok(),await r.text()).toBeTruthy();return r.json();};
    const save=async(p,plan,decisions={})=>{const r=await page.request.post('/api/table-import/commit',{data:{previewId:p.previewId,planId:plan.planId,confirm:true,decisions}});expect(r.ok(),await r.text()).toBeTruthy();return r.json();};
    const workspace=async()=> (await page.request.get(`${base}/workspace`)).json();
    let p=await inspect(csv('original')),plan=await compare(p,{'c1':{edits:{name:'Dome'}},'c2':{edits:{name:'Dome'}}});
    expect(plan.plan.filter(r=>r.status==='new')).toHaveLength(2);expect((await workspace()).equipment).toHaveLength(0);expect((await workspace()).files).toHaveLength(0);
    const noConfirm=await page.request.post('/api/table-import/commit',{data:{previewId:p.previewId,planId:plan.planId}});expect(noConfirm.status()).toBe(400);
    await save(p,plan);let w=await workspace();expect(w.equipment).toHaveLength(2);expect(w.files).toHaveLength(1);expect(w.equipment[0].catalog_item_id).toBe(w.equipment[1].catalog_item_id);
    expect((await (await page.request.get(`/api/documents/${w.files[0].id}/download`)).body()).toString()).toBe(csv('original'));
    const originalIds=w.equipment.map(e=>e.id).sort();
    p=await inspect(csv('original'));plan=await compare(p);expect(plan.duplicate).toBeTruthy();expect(plan.plan.every(r=>r.status==='unchanged')).toBeTruthy();await save(p,plan);
    w=await workspace();expect(w.files).toHaveLength(1);expect(w.equipment.map(e=>e.id).sort()).toEqual(originalIds);
    const c1=w.equipment.find(e=>e.tag==='C1'),c2=w.equipment.find(e=>e.tag==='C2');
    expect((await page.request.patch(`${base}/equipment/${c1.id}`,{data:{notes:'manual edit'}})).ok()).toBeTruthy();
    p=await inspect(csv('file edit'));plan=await compare(p);expect(plan.plan.find(r=>r.key==='c1').status).toBe('conflict');
    const unresolved=await page.request.post('/api/table-import/commit',{data:{previewId:p.previewId,planId:plan.planId,confirm:true}});expect(unresolved.status()).toBe(400);
    await save(p,plan,{c1:'keep'});w=await workspace();expect(w.equipment.find(e=>e.id===c1.id).notes).toBe('manual edit');expect(w.files).toHaveLength(2);
    p=await inspect(csv('file edit'));plan=await compare(p);expect(plan.plan.every(r=>r.status==='unchanged')).toBeTruthy();
    await page.request.patch(`${base}/equipment/${c2.id}`,{data:{notes:'changed after preview'}});
    const stale=await page.request.post('/api/table-import/commit',{data:{previewId:p.previewId,planId:plan.planId,confirm:true}});expect(stale.status()).toBe(409);plan=await compare(p);await save(p,plan);expect((await workspace()).files).toHaveLength(2);
    p=await inspect(`${project.name}\nid,task,hours,due\nW1,Installation work,2.5,2026-09-15`);plan=await compare(p);await save(p,plan);w=await workspace();expect(w.tasks.find(t=>t.title==='W1 · Installation work').estimated_hours).toBe('2.50');expect(w.timeEntries).toHaveLength(0);
    p=await inspect(`${project.name}\nid,task,hours,due\nW1,Installation work,3,2026-09-15`);plan=await compare(p);await save(p,plan);w=await workspace();expect(w.tasks.filter(t=>t.title==='W1 · Installation work')).toHaveLength(1);expect(Number(w.tasks.find(t=>t.title==='W1 · Installation work').estimated_hours)).toBe(3);expect(w.equipment.map(e=>e.id).sort()).toEqual(originalIds);
    const pdf=new jsPDF();pdf.setFontSize(10);
    for(let i=1;i<=2;i++){if(i>1)pdf.addPage();pdf.text(project.name,20,10);pdf.text('id',20,25);pdf.text('name',75,25);pdf.text('status',140,25);pdf.text(`PDF${i}`,20,35);pdf.text('Camera',75,35);pdf.text('installed',140,35);}
    const pdfResponse=await page.request.post('/api/table-import/inspect',{multipart:{file:{name:'two-pages.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf.output('arraybuffer'))}}});expect(pdfResponse.ok(),await pdfResponse.text()).toBeTruthy();
    p=await pdfResponse.json();expect(p.tables).toHaveLength(2);expect(p.tables.every(t=>t.enabled&&t.mapping.id!==undefined)).toBeTruthy();plan=await compare(p);expect(plan.plan.filter(r=>r.status==='new')).toHaveLength(2);await save(p,plan);expect((await workspace()).equipment).toHaveLength(4);
    const beforeCheck=await workspace();
    const checkResponse=await page.request.get(`/api/ai/project-check?projectId=${encodeURIComponent(project.id)}`);
    expect(checkResponse.ok(),await checkResponse.text()).toBeTruthy();const check=await checkResponse.json();
    expect(check.project.id).toBe(project.id);expect(check.checked.equipment).toBe(4);expect(check.findings.some(f=>f.key==='specification')).toBeTruthy();
    const afterCheck=await workspace();expect(afterCheck.equipment).toEqual(beforeCheck.equipment);expect(afterCheck.tasks).toEqual(beforeCheck.tasks);expect(afterCheck.files).toEqual(beforeCheck.files);
    expect((await page.request.get('/api/ai/project-check')).status()).toBe(400);
    expect((await page.request.get('/api/ai/project-check?projectId=missing-check-project')).status()).toBe(404);
  });
});
