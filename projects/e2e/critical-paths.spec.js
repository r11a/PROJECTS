import { test, expect } from '@playwright/test';

const hardenedPassword = 'Projects-CI-2026!';

async function webLogin(page, password = hardenedPassword) {
  await page.goto('/');
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.locator('form button[type="submit"], form button').last().click();
}

test.describe.serial('PROJECTS critical paths', () => {
  test('forces replacement of the initial administrator password', async ({ page }) => {
    await webLogin(page, 'change-me-now');
    await expect(page.getByText('החלפת סיסמה ראשונית')).toBeVisible();
    await page.locator('input[autocomplete="current-password"]').fill('change-me-now');
    const passwordInputs = page.locator('input[autocomplete="new-password"]');
    await passwordInputs.nth(0).fill(hardenedPassword);
    await passwordInputs.nth(1).fill(hardenedPassword);
    await page.getByRole('button', { name: 'שמירת סיסמה' }).click();
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
    const clients = await (await page.request.get('/api/clients')).json();
    const templates = await (await page.request.get('/api/project-templates')).json();
    expect(clients.clients.length).toBeGreaterThan(0);
    expect(templates.templates.length).toBeGreaterThan(0);
    const name = `CI Hardened ${Date.now()}`;
    const created = await page.request.post('/api/projects', { data:{ name, clientId:clients.clients[0].id, templateId:templates.templates[0].id, startDate:'2026-08-01' } });
    expect(created.ok()).toBeTruthy();
    const project = (await created.json()).project;
    const tasks = await (await page.request.get(`/api/tasks?projectId=${encodeURIComponent(project.id)}`)).json();
    expect(tasks.tasks.length).toBeGreaterThan(0);
  });

  test('rejects unsupported document uploads', async ({ page }) => {
    await webLogin(page);
    const response = await page.request.post('/api/documents', { multipart:{ file:{ name:'unsafe.exe', mimeType:'application/octet-stream', buffer:Buffer.from('MZ') }, title:'unsafe' } });
    expect(response.status()).toBe(415);
  });
});

