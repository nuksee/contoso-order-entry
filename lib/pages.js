// Page handlers. Each takes { method, path, query, body, user } and returns
// { html } or { redirect }. GET renders the page; POST is a WebForms postback.

import * as data from './data.js';
import { controls, drift } from './drift.js';
import { button, ctl, dropdown, errorSummary, esc, field, label, message, money, page, password, textarea, textbox, validator } from './render.js';

const SHIP_VIA = ['Ground', '2nd Day Air', 'Next Day Air', 'Will Call'];
const LINE_ROWS = 3;

export function login(ctx) {
  let error = '';
  if (ctx.method === 'POST') {
    const user = field(ctx.body, 'txtUserName').trim();
    const pass = field(ctx.body, 'txtPassword');
    if (user.toLowerCase() === 'demo' && pass === 'demo') {
      const back = ctx.query.get('ReturnUrl') || '';
      return { login: 'demo', redirect: /^\/(?!\/)/.test(back) ? back : '/Default.aspx' };
    }
    error = 'Your login attempt was not successful. Please try again.';
  }
  const body = `
    <p>Please enter your user name and password.</p>
    ${error ? `<div class="failureNotification" role="alert">${esc(error)}</div>` : ''}
    <fieldset class="login"><legend>Account Information</legend>
    <table class="form">
      <tr><td class="lbl">${label('txtUserName', 'User Name:')}</td><td>${textbox('txtUserName', field(ctx.body, 'txtUserName'))}</td></tr>
      <tr><td class="lbl">${label('txtPassword', 'Password:')}</td><td>${password('txtPassword')}</td></tr>
    </table></fieldset>
    <p class="submitButton">${button('btnLogin', 'Log In')}</p>`;
  return { html: page({ title: 'Log In', action: ctx.url, body }) };
}

export function home(ctx) {
  const body = `
    <p>Select a task from the menu above.</p>
    <ul class="tasks">
      <li><a id="${ctl('lnkCustomers').id}" href="/Customers/Search.aspx">Customer Inquiry</a> - find a customer and view account details</li>
      <li><a id="${ctl('lnkNewOrder').id}" href="/Orders/New.aspx">Order Entry</a> - key in a new sales order</li>
      <li><a id="${ctl('lnkStatus').id}" href="/Orders/Status.aspx">Order Status</a> - look up an existing sales order</li>
    </ul>
    <p class="note">Business date: ${esc(data.businessDate())}</p>`;
  return { html: page({ title: 'Main Menu', action: ctx.url, user: ctx.user, path: ctx.path, body }) };
}

export function customerSearch(ctx) {
  const id = field(ctx.body, 'txtSearchId');
  const name = field(ctx.body, 'txtSearchName');

  // GridView "Select" link posts back with __EVENTARGUMENT=Select$<row>.
  if (ctx.method === 'POST' && ctx.body.get('__EVENTTARGET') === ctl('gvCustomers').name) {
    const row = /^Select\$(\d+)$/.exec(ctx.body.get('__EVENTARGUMENT') || '');
    const hit = row && data.searchCustomers({ id, name })[+row[1]];
    if (hit) return { redirect: `/Customers/Details.aspx?id=${hit.id}` };
  }

  let results = '';
  if (ctx.method === 'POST') {
    const rows = data.searchCustomers({ id, name });
    const gv = ctl('gvCustomers');
    results = rows.length
      ? `<table class="grid" cellspacing="0" rules="all" border="1" id="${gv.id}">
          <tr class="gridHeader"><th scope="col">&nbsp;</th><th scope="col">Customer #</th><th scope="col">Name</th><th scope="col">City</th><th scope="col">State</th><th scope="col">Phone</th></tr>
          ${rows
            .map(
              (c, i) => `<tr class="${i % 2 ? 'gridAlt' : 'gridRow'}">
            <td><a href="javascript:__doPostBack('${gv.name}','Select$${i}')">Select</a></td>
            <td>${c.id}</td><td>${esc(c.name)}</td><td>${esc(c.city)}</td><td>${c.state}</td><td>${c.phone}</td></tr>`,
            )
            .join('')}
        </table>`
      : message('No customers match the search criteria.', 'error');
  }

  const body = `
    <fieldset><legend>Search Criteria</legend>
    <table class="form">
      <tr><td class="lbl">${label('txtSearchId', 'Customer #:')}</td><td>${textbox('txtSearchId', id, { width: 90, maxLength: 5 })}</td></tr>
      <tr><td class="lbl">${label('txtSearchName', 'Name contains:')}</td><td>${textbox('txtSearchName', name)}</td></tr>
      <tr><td></td><td>${button('btnSearch', 'Search')}</td></tr>
    </table></fieldset>
    ${results}`;
  return { html: page({ title: 'Customer Inquiry', action: ctx.url, user: ctx.user, path: '/Customers/Search.aspx', body }) };
}

export function customerDetails(ctx) {
  const c = data.findCustomer(ctx.query.get('id') || '');
  if (!c) {
    return { html: page({ title: 'Customer Details', action: ctx.url, user: ctx.user, body: message('Customer not found.', 'error') }) };
  }
  const span = (n, v) => `<span id="${ctl(n).id}">${esc(v)}</span>`;
  const orders = data.orders().filter((o) => o.customerId === c.id);
  const body = `
    <table class="details" id="${ctl('dvCustomer').id}" cellspacing="0" border="1">
      <tr><td class="lbl">Customer #</td><td>${span('lblCustomerId', c.id)}</td></tr>
      <tr><td class="lbl">Name</td><td>${span('lblName', c.name)}</td></tr>
      <tr><td class="lbl">Contact</td><td>${span('lblContact', c.contact)}</td></tr>
      <tr><td class="lbl">Phone</td><td>${span('lblPhone', c.phone)}</td></tr>
      <tr><td class="lbl">City / State</td><td>${span('lblCityState', `${c.city}, ${c.state}`)}</td></tr>
      <tr><td class="lbl">Credit Limit</td><td>${span('lblCreditLimit', money(c.creditLimit))}</td></tr>
      <tr><td class="lbl">Balance</td><td>${span('lblBalance', money(c.balance))}</td></tr>
      <tr><td class="lbl">Available Credit</td><td>${span('lblAvailable', money(c.creditLimit - c.balance))}</td></tr>
    </table>
    <h3>Orders</h3>
    ${
      orders.length
        ? `<table class="grid" cellspacing="0" rules="all" border="1" id="${ctl('gvOrders').id}">
        <tr class="gridHeader"><th scope="col">Order #</th><th scope="col">Date</th><th scope="col">Status</th><th scope="col">Total</th></tr>
        ${orders
          .map(
            (o, i) =>
              `<tr class="${i % 2 ? 'gridAlt' : 'gridRow'}"><td><a href="/Orders/Status.aspx?order=${o.number}">${o.number}</a></td><td>${o.orderDate}</td><td>${o.status}</td><td class="num">${money(data.orderTotal(o))}</td></tr>`,
          )
          .join('')}
      </table>`
        : '<p>No orders on file.</p>'
    }
    <p><a href="/Customers/Search.aspx">&laquo; Back to search</a></p>`;
  return { html: page({ title: 'Customer Details', action: ctx.url, user: ctx.user, path: '/Customers/Search.aspx', body }) };
}

export function orderStatus(ctx) {
  const ui = controls();
  const number = ctx.method === 'POST' ? field(ctx.body, ui.orderNumber.id) : ctx.query.get('order') || '';
  const searched = ctx.method === 'POST' || ctx.query.has('order');

  let result = '';
  if (searched) {
    const o = data.findOrder(number);
    if (!number.trim()) result = message('Enter an order number.', 'error');
    else if (!o) result = message(`Order ${esc(number.trim())} was not found.`, 'error');
    else {
      const c = data.findCustomer(o.customerId);
      const span = (n, v) => `<span id="${ctl(n).id}">${esc(v)}</span>`;
      result = `
      <table class="details" id="${ctl('dvOrder').id}" cellspacing="0" border="1">
        <tr><td class="lbl">Order #</td><td>${span('lblOrderNumber', o.number)}</td></tr>
        <tr><td class="lbl">Customer</td><td>${span('lblCustomer', `${c.id} - ${c.name}`)}</td></tr>
        <tr><td class="lbl">Status</td><td>${span('lblStatus', o.status)}</td></tr>
        <tr><td class="lbl">Order Date</td><td>${span('lblOrderDate', o.orderDate)}</td></tr>
        <tr><td class="lbl">Ship Date</td><td>${span('lblShipDate', o.shipDate || '-')}</td></tr>
        <tr><td class="lbl">Ship Via</td><td>${span('lblShipVia', o.shipVia)}</td></tr>
        <tr><td class="lbl">PO Number</td><td>${span('lblPoNumber', o.po || '-')}</td></tr>
        <tr><td class="lbl">Order Total</td><td>${span('lblTotal', money(data.orderTotal(o)))}</td></tr>
      </table>
      <table class="grid" cellspacing="0" rules="all" border="1" id="${ctl('gvLines').id}">
        <tr class="gridHeader"><th scope="col">SKU</th><th scope="col">Description</th><th scope="col">Qty</th><th scope="col">Unit Price</th><th scope="col">Extended</th></tr>
        ${o.lines
          .map((l, i) => {
            const p = data.findProduct(l.sku);
            return `<tr class="${i % 2 ? 'gridAlt' : 'gridRow'}"><td>${p.sku}</td><td>${esc(p.name)}</td><td class="num">${l.qty}</td><td class="num">${money(p.price)}</td><td class="num">${money(p.price * l.qty)}</td></tr>`;
          })
          .join('')}
      </table>`;
    }
  }

  const body = `
    <fieldset><legend>Find Order</legend>
    <table class="form">
      <tr><td class="lbl">${label(ui.orderNumber.id, ui.orderNumber.label)}</td><td>${textbox(ui.orderNumber.id, number, { width: 110, maxLength: 8 })} ${button(ui.lookup.id, ui.lookup.text)}</td></tr>
    </table></fieldset>
    ${result}`;
  return { html: page({ title: 'Order Status', action: '/Orders/Status.aspx', user: ctx.user, path: '/Orders/Status.aspx', body }) };
}

export function newOrder(ctx) {
  const ui = controls();
  const { move } = drift();
  const b = ctx.body;

  if (ctx.method === 'POST' && b.has(ctl('btnCancel').name)) return { redirect: '/Default.aspx' };

  let errors = [];
  let saved;
  if (ctx.method === 'POST' && b.has(ctl(ui.save.id).name)) {
    const lines = Array.from({ length: LINE_ROWS }, (_, i) => ({ sku: field(b, `ddlProduct${i + 1}`), qty: field(b, `txtQty${i + 1}`).trim() }));
    const res = data.createOrder({
      customerId: field(b, ui.customerId.id).trim(),
      shipTo: field(b, 'txtShipTo'),
      po: field(b, 'txtPoNumber'),
      shipVia: field(b, 'ddlShipVia') || SHIP_VIA[0],
      lines,
    });
    if (res.errors) errors = res.errors;
    else saved = res.order;
  }

  // After a successful save the form is cleared, like a postback that resets its controls.
  const v = (n) => (saved ? '' : field(b, n));
  const productOptions = [['', '-- Select --'], ...data.products().map((p) => [p.sku, `${p.sku}  ${p.name} (${money(p.price)})`])];
  const lineRows = Array.from(
    { length: LINE_ROWS },
    (_, i) => `<tr class="${i % 2 ? 'gridAlt' : 'gridRow'}"><td>${i + 1}</td><td>${dropdown(`ddlProduct${i + 1}`, productOptions, v(`ddlProduct${i + 1}`))}</td><td>${textbox(`txtQty${i + 1}`, v(`txtQty${i + 1}`), { width: 50, maxLength: 3 })}</td></tr>`,
  ).join('');

  const missing = (n) => ctx.method === 'POST' && !saved && !field(b, n).trim();
  const buttons = move
    ? `<div class="toolbar" id="${ctl('pnlToolbar').id}">${button(ui.save.id, ui.save.text)} ${button('btnCancel', 'Cancel')}</div>`
    : `<div class="buttons" id="${ctl('pnlButtons').id}">${button('btnCancel', 'Cancel')} ${button(ui.save.id, ui.save.text)}</div>`;
  const msg = saved
    ? message(`Order <b id="${ctl('lblOrderNumber').id}">${saved.number}</b> saved for customer ${saved.customerId}. Total ${money(data.orderTotal(saved))}.`, 'success')
    : message('');

  const body = `
    ${move ? buttons : ''}
    ${msg}
    ${errorSummary(errors)}
    <fieldset><legend>Customer</legend>
    <table class="form">
      <tr><td class="lbl">${label(ui.customerId.id, ui.customerId.label)}</td><td>${textbox(ui.customerId.id, v(ui.customerId.id), { width: 90, maxLength: 5 })} ${validator(ui.customerId.id, missing(ui.customerId.id))}</td></tr>
      <tr><td class="lbl">${label('txtShipTo', 'Ship To:')}</td><td>${textarea('txtShipTo', v('txtShipTo'))} ${validator('txtShipTo', missing('txtShipTo'))}</td></tr>
      <tr><td class="lbl">${label('txtPoNumber', 'PO Number:')}</td><td>${textbox('txtPoNumber', v('txtPoNumber'), { width: 120, maxLength: 20 })}</td></tr>
      <tr><td class="lbl">${label('ddlShipVia', 'Ship Via:')}</td><td>${dropdown('ddlShipVia', SHIP_VIA.map((s) => [s, s]), v('ddlShipVia'))}</td></tr>
    </table></fieldset>
    <fieldset><legend>Line Items</legend>
    <table class="grid" cellspacing="0" rules="all" border="1" id="${ctl('gvLines').id}">
      <tr class="gridHeader"><th scope="col">Line</th><th scope="col">Product</th><th scope="col">Qty</th></tr>
      ${lineRows}
    </table></fieldset>
    ${move ? '' : buttons}`;
  return { html: page({ title: 'New Sales Order', action: '/Orders/New.aspx', user: ctx.user, path: '/Orders/New.aspx', body }) };
}
