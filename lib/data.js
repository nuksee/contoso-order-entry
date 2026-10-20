// In-memory store with fixed seed data, so every run starts from the same state.

const SEED = {
  customers: [
    { id: 'C1001', name: 'Northwind Traders', contact: 'Maria Anders', phone: '(206) 555-0101', city: 'Seattle', state: 'WA', creditLimit: 5000, balance: 1240.5 },
    { id: 'C1002', name: 'Fabrikam Inc.', contact: 'Ana Trujillo', phone: '(425) 555-0144', city: 'Redmond', state: 'WA', creditLimit: 10000, balance: 8730.0 },
    { id: 'C1003', name: 'Adventure Works', contact: 'Thomas Hardy', phone: '(503) 555-0178', city: 'Portland', state: 'OR', creditLimit: 7500, balance: 0 },
    { id: 'C1004', name: 'Litware Supply', contact: 'Christina Berglund', phone: '(312) 555-0112', city: 'Chicago', state: 'IL', creditLimit: 2500, balance: 2380.25 },
    { id: 'C1005', name: 'Tailspin Toys', contact: 'Hanna Moos', phone: '(512) 555-0190', city: 'Austin', state: 'TX', creditLimit: 4000, balance: 615.0 },
    { id: 'C1006', name: 'Wide World Importers', contact: 'Martin Sommer', phone: '(617) 555-0133', city: 'Boston', state: 'MA', creditLimit: 15000, balance: 3120.75 },
  ],
  products: [
    { sku: 'P-100', name: 'Widget, Standard', price: 4.5 },
    { sku: 'P-110', name: 'Widget, Deluxe', price: 7.25 },
    { sku: 'P-200', name: 'Gear Assembly', price: 18.0 },
    { sku: 'P-300', name: 'Bearing Kit', price: 12.4 },
    { sku: 'P-400', name: 'Hydraulic Hose 6ft', price: 22.95 },
  ],
  orders: [
    { number: 'SO-10041', customerId: 'C1001', orderDate: '2026-09-28', shipDate: '2026-10-02', status: 'Shipped', shipVia: 'Ground', shipTo: 'Northwind Traders\n410 Pine St\nSeattle, WA 98101', po: 'NW-7781', lines: [{ sku: 'P-100', qty: 120 }, { sku: 'P-300', qty: 10 }] },
    { number: 'SO-10042', customerId: 'C1003', orderDate: '2026-10-06', shipDate: null, status: 'Backordered', shipVia: '2nd Day Air', shipTo: 'Adventure Works\n22 Harbor Way\nPortland, OR 97209', po: 'AW-0193', lines: [{ sku: 'P-200', qty: 40 }] },
    { number: 'SO-10043', customerId: 'C1001', orderDate: '2026-10-12', shipDate: null, status: 'Open', shipVia: 'Ground', shipTo: 'Northwind Traders\n410 Pine St\nSeattle, WA 98101', po: '', lines: [{ sku: 'P-110', qty: 60 }, { sku: 'P-400', qty: 4 }] },
    { number: 'SO-10044', customerId: 'C1005', orderDate: '2026-10-14', shipDate: null, status: 'Cancelled', shipVia: 'Next Day Air', shipTo: 'Tailspin Toys\n9 Congress Ave\nAustin, TX 78701', po: 'TT-552', lines: [{ sku: 'P-100', qty: 25 }] },
  ],
  nextOrder: 10045,
};

let db;

export function reset() {
  db = structuredClone(SEED);
}
reset();

export const customers = () => db.customers;
export const products = () => db.products;
export const orders = () => db.orders;

export const findCustomer = (id) => db.customers.find((c) => c.id.toUpperCase() === String(id).trim().toUpperCase());
export const findOrder = (num) => db.orders.find((o) => o.number.toUpperCase() === String(num).trim().toUpperCase());
export const findProduct = (sku) => db.products.find((p) => p.sku === sku);

export function searchCustomers({ id, name }) {
  id = (id || '').trim().toUpperCase();
  name = (name || '').trim().toLowerCase();
  return db.customers.filter((c) => (!id || c.id.startsWith(id)) && (!name || c.name.toLowerCase().includes(name)));
}

export const orderTotal = (o) => o.lines.reduce((sum, l) => sum + findProduct(l.sku).price * l.qty, 0);

export function businessDate() {
  return process.env.BUSINESS_DATE || new Date().toISOString().slice(0, 10);
}

// Validates and saves an order. Returns { order } or { errors }.
export function createOrder({ customerId, shipTo, po, shipVia, lines }) {
  const errors = [];
  const customer = findCustomer(customerId || '');
  if (!customerId) errors.push('Customer # is required.');
  else if (!customer) errors.push(`Customer ${customerId} was not found.`);
  if (!shipTo || !shipTo.trim()) errors.push('Ship To is required.');

  const parsed = [];
  lines.forEach((l, i) => {
    if (!l.sku && !l.qty) return;
    if (!l.sku) return errors.push(`Line ${i + 1}: select a product.`);
    if (!/^\d+$/.test(l.qty) || +l.qty < 1 || +l.qty > 999) return errors.push(`Line ${i + 1}: quantity must be a whole number from 1 to 999.`);
    parsed.push({ sku: l.sku, qty: +l.qty });
  });
  if (!parsed.length && !errors.some((e) => e.startsWith('Line'))) errors.push('Enter at least one line item.');

  const order = { number: `SO-${db.nextOrder}`, customerId: customer?.id, orderDate: businessDate(), shipDate: null, status: 'Open', shipVia, shipTo: (shipTo || '').trim(), po: (po || '').trim(), lines: parsed };
  if (!errors.length && customer.balance + orderTotal(order) > customer.creditLimit) {
    errors.push(`Credit limit exceeded for ${customer.id}. Available credit: $${(customer.creditLimit - customer.balance).toFixed(2)}.`);
  }
  if (errors.length) return { errors };

  db.nextOrder++;
  customer.balance += orderTotal(order);
  db.orders.push(order);
  return { order };
}
