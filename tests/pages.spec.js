import { expect, test } from '@playwright/test';

// The static build: a service worker runs the app inside the browser.
// Each test gets a fresh browser context, so a fresh worker and empty storage.
// Runs twice: under /contoso-order-entry/ (GitHub Pages) and at / (Vercel).

const base = () => new URL(test.info().project.use.baseURL).pathname;
const at = (path) => new RegExp('^[^?]*//[^/]+' + (base() + path).replace(/[.?]/g, '\\$&'));

async function logIn(page) {
  await page.goto('Orders/New.aspx'); // unknown to the static host: 404.html installs the worker first
  await expect(page).toHaveURL(/Login\.aspx\?ReturnUrl=/);
  await page.fill('#ctl00_MainContent_txtUserName', 'demo');
  await page.fill('#ctl00_MainContent_txtPassword', 'demo');
  await page.click('#ctl00_MainContent_btnLogin');
  await expect(page).toHaveURL(new RegExp(at('Orders/New.aspx').source + '$'));
}

test('landing page starts the app and links stay under the base path', async ({ page }) => {
  await page.goto('');
  await expect(page).toHaveURL(at('Login.aspx'));
  await expect(page.locator('link[rel=stylesheet]')).toHaveAttribute('href', base() + 'Styles/Site.css');
  await expect(page.locator('#header')).toHaveCSS('background-color', 'rgb(75, 108, 158)');
});

test('create an order, then look it up, and it survives a worker restart', async ({ page }) => {
  await logIn(page);
  await page.fill('#ctl00_MainContent_txtCustomerId', 'C1003');
  await page.fill('#ctl00_MainContent_txtShipTo', 'Adventure Works');
  await page.selectOption('#ctl00_MainContent_ddlProduct1', 'P-200');
  await page.fill('#ctl00_MainContent_txtQty1', '10');
  await page.click('#ctl00_MainContent_btnSave');
  await expect(page.locator('#ctl00_MainContent_lblOrderNumber')).toHaveText('SO-10045');

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('ServiceWorker.enable');
  await cdp.send('ServiceWorker.stopAllWorkers');

  await page.goto('Orders/Status.aspx?order=SO-10045');
  await expect(page.locator('#ctl00_MainContent_lblStatus')).toHaveText('Open');
  await expect(page.locator('#ctl00_MainContent_lblTotal')).toHaveText('$180.00');
});

test('customer search grid postback works', async ({ page }) => {
  await logIn(page);
  await page.click('text=Customers');
  await page.fill('#ctl00_MainContent_txtSearchName', 'north');
  await page.click('#ctl00_MainContent_btnSearch');
  await page.click('#ctl00_MainContent_gvCustomers >> text=Select');
  await expect(page.locator('#ctl00_MainContent_lblBalance')).toHaveText('$1,240.50');
});

test('demo controls rename and move controls, and reset restores them', async ({ page }) => {
  await logIn(page);
  await page.goto('__admin');
  await page.check('input[name=rename]');
  await page.check('input[name=move]');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('#current')).toHaveText('Now: rename on, move on');

  await page.goto('Orders/New.aspx');
  await expect(page.getByLabel('Account No.:')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Order' })).toBeVisible();
  await expect(page.locator('#ctl00_MainContent_pnlToolbar')).toBeVisible();

  await page.goto('__admin');
  await page.getByRole('button', { name: 'Reset data and drift' }).click();
  await expect(page.locator('#current')).toHaveText('Now: rename off, move off');
  await page.goto('Orders/New.aspx');
  await expect(page.getByLabel('Customer #:')).toBeVisible();
});
