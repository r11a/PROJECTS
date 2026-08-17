import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

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
    expect(importResponse.ok()).toBeTruthy();
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
});
