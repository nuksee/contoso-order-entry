// UI drift switches for the self-heal demo. Each one changes the screens the
// way a vendor patch would, without changing what the app does.
//   rename: control IDs and labels change (Customer # -> Account No., etc.)
//   move:   the New Order buttons move to a toolbar above the form, in a new order
// Set at start-up with DRIFT=rename,move or live from /__admin.

const state = { rename: false, move: false };

for (const k of (process.env.DRIFT || '').split(',').map((s) => s.trim())) {
  if (k in state) state[k] = true;
}

export const drift = () => ({ ...state });

export function setDrift(next) {
  for (const k of Object.keys(state)) if (k in next) state[k] = Boolean(next[k]);
  return drift();
}

// Control IDs and captions for each variant.
export function controls() {
  return state.rename
    ? {
        customerId: { id: 'txtAccountNo', label: 'Account No.:' },
        save: { id: 'btnSubmit', text: 'Submit Order' },
        orderNumber: { id: 'txtSalesOrderNo', label: 'Sales Order No.:' },
        lookup: { id: 'btnFind', text: 'Find' },
      }
    : {
        customerId: { id: 'txtCustomerId', label: 'Customer #:' },
        save: { id: 'btnSave', text: 'Save Order' },
        orderNumber: { id: 'txtOrderNumber', label: 'Order #:' },
        lookup: { id: 'btnLookup', text: 'Look Up' },
      };
}
