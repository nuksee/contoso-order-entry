// HTML helpers that mimic the markup ASP.NET WebForms 3.5/4.0 emits:
// one page-wide <form id="aspnetForm">, ctl00$MainContent$ control names,
// __VIEWSTATE / __EVENTVALIDATION hidden fields and __doPostBack links.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const money = (n) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const ctl = (n) => ({ name: `ctl00$MainContent$${n}`, id: `ctl00_MainContent_${n}` });

// Reads a posted control value by its short server ID.
export const field = (body, n) => body.get(ctl(n).name) ?? '';

export function label(forId, text) {
  return `<label for="${ctl(forId).id}" id="${ctl('lbl' + forId.replace(/^(txt|ddl|rbl)/, '')).id}">${esc(text)}</label>`;
}

export function textbox(n, value = '', { width = 180, maxLength } = {}) {
  const c = ctl(n);
  const ml = maxLength ? ` maxlength="${maxLength}"` : '';
  return `<input name="${c.name}" type="text" value="${esc(value)}"${ml} id="${c.id}" class="txt" style="width:${width}px;" />`;
}

export function textarea(n, value = '', rows = 3) {
  const c = ctl(n);
  return `<textarea name="${c.name}" rows="${rows}" cols="30" id="${c.id}" class="txt">${esc(value)}</textarea>`;
}

export function password(n) {
  const c = ctl(n);
  return `<input name="${c.name}" type="password" id="${c.id}" class="txt" style="width:180px;" />`;
}

export function dropdown(n, options, selected = '') {
  const c = ctl(n);
  const opts = options
    .map(([v, t]) => `<option${v === selected ? ' selected="selected"' : ''} value="${esc(v)}">${esc(t)}</option>`)
    .join('');
  return `<select name="${c.name}" id="${c.id}" class="ddl">${opts}</select>`;
}

export function button(n, text) {
  const c = ctl(n);
  return `<input type="submit" name="${c.name}" value="${esc(text)}" id="${c.id}" class="btn" />`;
}

export function validator(forId, show, text = '*') {
  const id = ctl('rfv' + forId.replace(/^(txt|ddl)/, '')).id;
  return `<span id="${id}" class="validator" style="visibility:${show ? 'visible' : 'hidden'};">${esc(text)}</span>`;
}

export function message(text, kind = 'info') {
  const id = ctl('lblMessage').id;
  if (!text) return `<span id="${id}"></span>`;
  return `<span id="${id}" class="msg msg-${kind}" role="${kind === 'error' ? 'alert' : 'status'}">${text}</span>`;
}

export function errorSummary(errors) {
  if (!errors?.length) return '';
  return `<div id="${ctl('ValidationSummary1').id}" class="valsummary" role="alert">Please correct the following:<ul>${errors
    .map((e) => `<li>${esc(e)}</li>`)
    .join('')}</ul></div>`;
}

// Looks like viewstate, means nothing. Stable for a given page and content.
// Plain JS (no node:crypto) so the same code runs in the browser build.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function fakeState(prefix, seed) {
  let out = '';
  for (let round = 0; round < 7; round++) {
    let h = 0x811c9dc5 ^ round;
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
    for (let k = 0; k < 6; k++) out += B64[(h >>> (k * 5)) & 63];
  }
  return prefix + out + 'ZGQ=';
}

const MENU = [
  ['Home', '/Default.aspx'],
  ['Customers', '/Customers/Search.aspx'],
  ['New Order', '/Orders/New.aspx'],
  ['Order Status', '/Orders/Status.aspx'],
];

export function page({ title, action, user, body, path }) {
  const menu = user
    ? `<div id="menu"><table class="menu" cellpadding="0" cellspacing="0"><tr>${MENU.map(
        ([t, href]) => `<td><a href="${href}" class="menuItem${href === path ? ' selected' : ''}">${t}</a></td>`,
      ).join('')}</tr></table></div>`
    : '';
  const login = user
    ? `Welcome <span class="bold">${esc(user)}</span>! [ <a id="HeadLoginView_HeadLoginStatus" href="/Logout.aspx">Log Out</a> ]`
    : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Contoso Order Entry - ${esc(title)}</title>
<meta http-equiv="X-UA-Compatible" content="IE=EmulateIE8" />
<link href="/Styles/Site.css" rel="stylesheet" type="text/css" /></head>
<body>
<form method="post" action="${esc(action)}" id="aspnetForm">
<div class="aspNetHidden">
<input type="hidden" name="__EVENTTARGET" id="__EVENTTARGET" value="" />
<input type="hidden" name="__EVENTARGUMENT" id="__EVENTARGUMENT" value="" />
<input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="${fakeState('/wEPDwUKMTY1NDU2MTA1Mg9kFgJmD2QWAgID', action + body)}" />
</div>
<script type="text/javascript">
//<![CDATA[
var theForm = document.forms['aspnetForm'];
function __doPostBack(eventTarget, eventArgument) {
    if (!theForm.onsubmit || (theForm.onsubmit() != false)) {
        theForm.__EVENTTARGET.value = eventTarget;
        theForm.__EVENTARGUMENT.value = eventArgument;
        theForm.submit();
    }
}
//]]>
</script>
<div class="page">
  <div id="header">
    <div class="title"><h1>Contoso Order Entry System</h1></div>
    <div class="loginDisplay">${login}</div>
    ${menu}
  </div>
  <div id="main">
    <h2>${esc(title)}</h2>
${body}
  </div>
  <div id="footer">Contoso Order Entry v4.2.1187 &nbsp;|&nbsp; &copy; 2009 Contoso Ltd. All rights reserved.</div>
</div>
<div class="aspNetHidden">
<input type="hidden" name="__EVENTVALIDATION" id="__EVENTVALIDATION" value="${fakeState('/wEdAAaD', title)}" />
</div>
</form>
</body>
</html>`;
}
