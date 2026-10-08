// Order and line data shapes (ORDER_FORM_SCOPE.md §4.3, §6.2). Pure: no DOM.
// Attached File/Blob objects are NOT stored here; lines hold file metadata only and the
// actual bytes live in a separate map keyed by line key (see main.js / draft.js).

import { REQUEST_ID, REQUEST_LABEL, fileKindFor } from './limits.js';

let keySeq = 0;
export function newKey() {
  keySeq += 1;
  return 'L' + Date.now().toString(36) + keySeq.toString(36) + Math.random().toString(36).slice(2, 6);
}

// Address source:
//  - 'link-0', 'link-1', …  : one of the locations that came in the link
//  - 'entered'               : the customer typed it
export function createOrder(config) {
  const locs = config.locations || [];
  return {
    customer: {
      company: config.prefill.company || '',
      contact: config.prefill.contact || '',
      email: config.prefill.email || '',
      phone: config.prefill.phone || '',
      po: config.quoteRef || '',
      neededBy: '',
      notes: '',
      street: '', city: '', state: '', zip: '',
      addressSource: locs.length ? 'link-0' : 'entered',
    },
    lines: [],
  };
}

export function newLine({ partNumber = '', file = null } = {}) {
  return { key: newKey(), partNumber, materialId: '', qty: 1, notes: '', file };
}

// "bracket-A.dxf" → "bracket-A"
export function partNumberFromFileName(name) {
  return String(name || '').replace(/\.(dxf|step|stp)$/i, '').trim();
}

export function findMaterial(config, id) {
  if (id === REQUEST_ID) return { id: REQUEST_ID, label: REQUEST_LABEL, type: REQUEST_ID };
  return config.materials.find(m => m.id === id) || null;
}

// File kind the line's material accepts: 'dxf', 'step', or null (any, or no material yet).
export function acceptedKind(config, line) {
  const mat = findMaterial(config, line.materialId);
  return mat ? fileKindFor(mat.type) : null;
}

// The customer's address as it will be sent: a chosen link location, or what they typed.
export function effectiveAddress(config, customer) {
  const m = /^link-(\d+)$/.exec(customer.addressSource || '');
  if (m && config.locations[Number(m[1])]) {
    return { ...config.locations[Number(m[1])], source: 'link' };
  }
  return { street: customer.street, city: customer.city, state: customer.state, zip: customer.zip, source: 'entered' };
}

export function addressRequired(customer) {
  return !/^link-\d+$/.test(customer.addressSource || '');
}
