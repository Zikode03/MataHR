import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const state = JSON.parse(
  readFileSync(process.env.MATAHR_E2E_STATE ?? resolve('.local/connected-browser.json'), 'utf8'),
) as { tenantId: string; password: string };
let client = 20;
async function login(page: Page, email: string) {
  await page.context().setExtraHTTPHeaders({ 'X-Test-Client-IP': '192.0.2.' + client++ });
  await page.goto('/login');
  await page.getByLabel('Work email', { exact: true }).fill(email + '@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill(state.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const acknowledgement = page.getByRole('button', { name: 'I acknowledge · open workspace' });
  await expect(
    page.getByRole('heading', {
      name: /System overview|HR dashboard|My team|My workspace|Your information at work/,
    }),
  ).toBeVisible();
  if (await acknowledgement.isVisible()) await acknowledgement.click();
  await expect(page.getByRole('navigation')).toBeVisible({ timeout: 30000 });
  await page.getByLabel('Account menu', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeEnabled();
  await page.getByLabel('Account menu', { exact: true }).click();
}
async function post(page: Page, path: string, body: unknown) {
  const response = await page.request.post('/api' + path, {
    data: body,
    headers: { 'X-MataHR-Request': '1' },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

test('Admin workspace manages native accounts and respects payroll boundaries', async ({
  page,
}) => {
  await login(page, 'admin');
  await expect(page.getByRole('heading', { name: 'System overview', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Employees', exact: true })).toHaveCount(0);
  expect((await page.request.get('/api/payroll/salaries')).status()).toBe(403);
  await expect(page.getByRole('heading', { name: 'Set up your people workspace' })).toBeVisible();
  await expect(page.getByLabel('Account overview')).toContainText('Total accounts');
  await expect(page.locator('.live-header-context')).toContainText('Administration');
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
  await expect(page.locator('.live-sidebar')).toHaveCSS('width', '80px');
  await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(page.locator('.content')).toHaveAttribute('inert', '');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 720 });
  const overviewResponse = await page.request.get('/api/admin/overview');
  expect(overviewResponse.status()).toBe(200);
  const overview = await overviewResponse.json();
  expect(overview.totalAccounts).toBe(overview.activeAccounts + overview.inactiveAccounts);
  await page.getByRole('link', { name: 'Roles & permissions', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Role permissions', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Audit trail', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recent audit events' })).toBeVisible();
  await page.getByRole('link', { name: 'User management', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Assigned accounts' })).toBeVisible();
  await page.getByRole('button', { name: 'Add user', exact: true }).click();
  const form = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Create account' }) });
  await form.getByLabel('Work email', { exact: true }).fill('browser-hr@example.invalid');
  await form.getByLabel('Initial password', { exact: false }).fill('Browser-Created-Account42!');
  await form.getByLabel('Employee', { exact: true }).uncheck();
  await form.getByLabel('HR', { exact: true }).check();
  await form.getByRole('button', { name: 'Create user', exact: true }).click();
  await expect(page.getByText('browser-hr@example.invalid', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('browser-hr@example.invalid', { exact: true })).toBeVisible();
});

test('HR creates a persistent employee, organisation records and dated payroll inputs', async ({
  page,
}) => {
  await login(page, 'hr');
  await page.getByRole('link', { name: 'Employees', exact: true }).click();
  await page.getByRole('button', { name: 'Add employee', exact: true }).click();
  const form = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Create employee' }) });
  await form.getByLabel('Employee number', { exact: true }).fill('BROWSER-01');
  await form.getByLabel('Full name', { exact: true }).fill('Browser Employee');
  await form.getByLabel('Work email', { exact: true }).fill('browser-employee@example.invalid');
  await form.getByLabel('Start date', { exact: true }).fill('2020-01-01');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Browser Employee', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('cell', { name: 'Browser Employee', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Organisation', exact: true }).click();
  await page.getByRole('button', { name: 'Branches', exact: true }).click();
  const branch = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Add branch' }) });
  await branch.getByLabel('Name', { exact: true }).fill('Browser branch');
  await branch.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(branch.getByRole('status')).toContainText('Saved successfully');
  await page.getByRole('link', { name: 'Payroll & benefits', exact: true }).click();
  const salary = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Add compensation revision' }) });
  await salary
    .getByRole('combobox', { name: 'Employee', exact: true })
    .selectOption({ label: 'Browser Employee' });
  await salary.getByLabel('Monthly basic', { exact: true }).fill('18500');
  await salary.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(salary.getByRole('status')).toContainText('Saved successfully');
  await expect(
    page.getByRole('row').filter({ hasText: 'Browser Employee' }).filter({ hasText: '18' }).first(),
  ).toBeVisible();
});

test('Manager sees direct reports and cannot use system or payroll administration', async ({
  page,
}) => {
  await login(page, 'manager');
  await page.getByRole('link', { name: 'Team directory', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Alice', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Outsider', exact: true })).toHaveCount(0);
  expect((await page.request.get('/api/admin/accounts')).status()).toBe(403);
  expect((await page.request.get('/api/payroll/salaries')).status()).toBe(403);
  expect((await page.request.get('/api/admin/overview')).status()).toBe(403);
  await expect(page.getByRole('link', { name: 'User management', exact: true })).toHaveCount(0);
});

test('Employee clocking uses real site code and GPS, and leave follows manager then HR review', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const hrContext = await browser.newContext({ ignoreHTTPSErrors: true }),
    employeeContext = await browser.newContext({
      ignoreHTTPSErrors: true,
      permissions: ['geolocation'],
      geolocation: { latitude: -29.78, longitude: 30.77, accuracy: 10 },
    }),
    managerContext = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const hr = await hrContext.newPage(),
      employee = await employeeContext.newPage(),
      manager = await managerContext.newPage();
    await login(hr, 'hr');
    await hr.getByRole('link', { name: 'Digital register', exact: true }).click();
    const add = hr
      .locator('form')
      .filter({ has: hr.getByRole('heading', { name: 'Add a location' }) });
    await add.getByLabel('Location name', { exact: true }).fill('Browser verified office');
    await add.getByRole('combobox', { name: 'Type', exact: true }).selectOption('Office');
    await add.getByRole('button', { name: 'Save', exact: true }).click();
    const boundary = hr
      .locator('form')
      .filter({ has: hr.getByRole('heading', { name: 'Browser verified office · GPS boundary' }) });
    await boundary.getByLabel('Latitude', { exact: true }).fill('-29.78');
    await boundary.getByLabel('Longitude', { exact: true }).fill('30.77');
    await boundary.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(boundary.getByRole('status')).toContainText('Saved successfully');
    await hr
      .getByRole('combobox', { name: 'Site', exact: true })
      .selectOption({ label: 'Browser verified office' });
    await hr.getByRole('button', { name: 'Generate / rotate code' }).click();
    const code = hr.locator('output.live-site-code');
    await expect(code).toHaveText(/^\d{8}$/);
    const siteCode = (await code.textContent())!;
    await login(employee, 'alice');
    await expect(employee.getByRole('link', { name: 'User management' })).toHaveCount(0);
    await employee.getByRole('link', { name: 'Digital register', exact: true }).click();
    await employee
      .getByRole('combobox', { name: 'Work location', exact: true })
      .selectOption({ label: 'Browser verified office · Office' });
    await employee.getByLabel('Current on-site code', { exact: true }).fill(siteCode);
    await employee.getByRole('button', { name: 'Clock in', exact: true }).click();
    await expect(
      employee.getByRole('heading', { name: 'You’re clocked in', exact: true }),
    ).toBeVisible();
    await expect(
      employee.getByText('On-site code + GPS checked', { exact: false }).first(),
    ).toBeVisible();
    await employee.reload();
    await expect(employee.getByRole('button', { name: 'Clock out', exact: true })).toBeVisible();
    await employee.getByRole('button', { name: 'Clock out', exact: true }).click();
    await expect(
      employee.getByRole('heading', { name: 'Start your working day', exact: true }),
    ).toBeVisible();
    await employee.getByRole('link', { name: 'Leave management', exact: true }).click();
    const application = employee
      .locator('form')
      .filter({ has: employee.getByRole('heading', { name: 'Apply for leave' }) });
    await application
      .getByRole('combobox', { name: 'Leave policy', exact: true })
      .selectOption({ label: 'Annual' });
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 7);
    while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
    const day = date.toISOString().slice(0, 10);
    await application.getByLabel('From', { exact: true }).fill(day);
    await application.getByLabel('To', { exact: true }).fill(day);
    await application.getByLabel('Reason', { exact: true }).fill('Browser leave request');
    await application.getByRole('button', { name: 'Submit application' }).click();
    await expect(application.getByRole('status')).toContainText('Saved successfully');
    await login(manager, 'manager');
    await manager.getByRole('link', { name: 'Leave & approvals', exact: true }).click();
    const managerReview = manager.locator('article').filter({ hasText: 'Browser leave request' });
    await managerReview
      .getByLabel('Decision reason', { exact: true })
      .fill('Manager confirms cover is available');
    await managerReview.getByRole('button', { name: 'Record decision' }).click();
    await expect(managerReview).toContainText('Pending · HR');
    await hr.getByRole('link', { name: 'Leave management', exact: true }).click();
    const hrReview = hr.locator('article').filter({ hasText: 'Browser leave request' });
    await hrReview
      .getByLabel('Decision reason', { exact: true })
      .fill('HR independently reviewed the application');
    await hrReview.getByRole('button', { name: 'Record decision' }).click();
    await expect(hrReview).toContainText('Approved · Complete');
    await employee.reload();
    await expect(
      employee.locator('article').filter({ hasText: 'Browser leave request' }),
    ).toContainText('Approved · Complete');
    await employee.getByRole('link', { name: 'My workspace', exact: true }).click();
    await expect(
      employee.getByRole('heading', { name: 'My workspace', exact: true }),
    ).toBeVisible();
    await expect(
      employee.getByRole('heading', { name: 'My leave balances', exact: true }),
    ).toBeVisible();
    await expect(employee.getByText('Loading records…', { exact: true })).toHaveCount(0, {
      timeout: 30000,
    });
    await expect(employee.getByRole('heading', { name: 'Alice', exact: true })).toBeVisible();
    await employee.screenshot({ path: '.local/employee-workspace.png', fullPage: true });
  } finally {
    await Promise.all([hrContext.close(), employeeContext.close(), managerContext.close()]);
  }
});
