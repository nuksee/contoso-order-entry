import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  await request.post('/__admin/reset', { data: {} });
  await page.goto('/Default.aspx');
  await page.fill('#ctl00_MainContent_txtUserName', 'demo');
  await page.fill('#ctl00_MainContent_txtPassword', 'demo');
  await page.click('#ctl00_MainContent_btnLogin');
  await expect(page).toHaveURL(/Default\.aspx/);
});

test('rejects a bad password', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/Login.aspx');
  await page.fill('#ctl00_MainContent_txtUserName', 'demo');
  await page.fill('#ctl00_MainContent_txtPassword', 'nope');
  await page.click('#ctl00_MainContent_btnLogin');
  await expect(page.getByRole('alert')).toContainText('not successful');
});

test('read: look up a customer through the search grid', async ({ page }) => {
  await page.click('text=Customers');
  await page.fill('#ctl00_MainContent_txtSearchName', 'north');
  await page.click('#ctl00_MainContent_btnSearch');
  await page.click('#ctl00_MainContent_gvCustomers >> text=Select');
  await expect(page).toHaveURL(/Details\.aspx\?id=C1001/);
  await expect(page.locator('#ctl00_MainContent_lblName')).toHaveText('Northwind Traders');
  await expect(page.locator('#ctl00_MainContent_lblBalance')).toHaveText('$1,240.50');
  await expect(page.locator('#ctl00_MainContent_lblAvailable')).toHaveText('$3,759.50');
});

test('read: order status', async ({ page }) => {
  await page.goto('/Orders/Status.aspx');
  await page.fill('#ctl00_MainContent_txtOrderNumber', 'SO-10042');
  await page.click('#ctl00_MainContent_btnLookup');
  await expect(page.locator('#ctl00_MainContent_lblStatus')).toHaveText('Backordered');
  await expect(page.locator('#ctl00_MainContent_lblTotal')).toHaveText('$720.00');

  await page.fill('#ctl00_MainContent_txtOrderNumber', 'SO-99999');
  await page.click('#ctl00_MainContent_btnLookup');
  await expect(page.locator('#ctl00_MainContent_lblMessage')).toHaveText('Order SO-99999 was not found.');
});

test('write: create an order, then verify it on the status page', async ({ page }) => {
  await page.goto('/Orders/New.aspx');
  await page.fill('#ctl00_MainContent_txtCustomerId', 'C1003');
  await page.fill('#ctl00_MainContent_txtShipTo', 'Adventure Works\n22 Harbor Way\nPortland, OR 97209');
  await page.fill('#ctl00_MainContent_txtPoNumber', 'AW-0200');
  await page.selectOption('#ctl00_MainContent_ddlShipVia', 'Next Day Air');
  await page.selectOption('#ctl00_MainContent_ddlProduct1', 'P-200');
  await page.fill('#ctl00_MainContent_txtQty1', '10');
  await page.selectOption('#ctl00_MainContent_ddlProduct2', 'P-300');
  await page.fill('#ctl00_MainContent_txtQty2', '5');
  await page.click('#ctl00_MainContent_btnSave');

  await expect(page.locator('#ctl00_MainContent_lblOrderNumber')).toHaveText('SO-10045');
  await expect(page.locator('#ctl00_MainContent_lblMessage')).toContainText('Total $242.00');

  await page.goto('/Orders/Status.aspx?order=SO-10045');
  await expect(page.locator('#ctl00_MainContent_lblStatus')).toHaveText('Open');
  await expect(page.locator('#ctl00_MainContent_lblOrderDate')).toHaveText('2026-10-27');
  await expect(page.locator('#ctl00_MainContent_lblTotal')).toHaveText('$242.00');
});

test('write: validation and credit limit errors', async ({ page }) => {
  await page.goto('/Orders/New.aspx');
  await page.click('#ctl00_MainContent_btnSave');
  const summary = page.locator('#ctl00_MainContent_ValidationSummary1');
  await expect(summary).toContainText('Customer # is required.');
  await expect(summary).toContainText('Ship To is required.');
  await expect(summary).toContainText('Enter at least one line item.');

  await page.fill('#ctl00_MainContent_txtCustomerId', 'C1004');
  await page.fill('#ctl00_MainContent_txtShipTo', 'Litware Supply');
  await page.selectOption('#ctl00_MainContent_ddlProduct1', 'P-400');
  await page.fill('#ctl00_MainContent_txtQty1', '10');
  await page.click('#ctl00_MainContent_btnSave');
  await expect(summary).toContainText('Credit limit exceeded for C1004');
});

test('drift: rename and move break the old selectors but not the task', async ({ page, request }) => {
  await request.post('/__admin/drift', { data: { rename: true, move: true } });

  await page.goto('/Orders/New.aspx');
  await expect(page.locator('#ctl00_MainContent_txtCustomerId')).toHaveCount(0);
  await expect(page.locator('#ctl00_MainContent_btnSave')).toHaveCount(0);
  await expect(page.locator('#ctl00_MainContent_pnlToolbar')).toBeVisible();

  // The toolbar now sits above the Customer fieldset.
  const toolbarY = (await page.locator('#ctl00_MainContent_pnlToolbar').boundingBox()).y;
  const fieldsetY = (await page.locator('fieldset').first().boundingBox()).y;
  expect(toolbarY).toBeLessThan(fieldsetY);

  await page.getByLabel('Account No.:').fill('C1003');
  await page.getByLabel('Ship To:').fill('Adventure Works');
  await page.selectOption('#ctl00_MainContent_ddlProduct1', 'P-100');
  await page.fill('#ctl00_MainContent_txtQty1', '2');
  await page.getByRole('button', { name: 'Submit Order' }).click();
  await expect(page.locator('#ctl00_MainContent_lblOrderNumber')).toHaveText('SO-10045');

  await page.goto('/Orders/Status.aspx');
  await page.getByLabel('Sales Order No.:').fill('SO-10045');
  await page.getByRole('button', { name: 'Find' }).click();
  await expect(page.locator('#ctl00_MainContent_lblStatus')).toHaveText('Open');
});
