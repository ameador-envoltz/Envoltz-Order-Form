// Order validation (ORDER_FORM_SCOPE.md §4.5). Pure: no DOM.
// Returns every problem at once, so the customer never has to find them one at a time.
// problems block sending; warnings don't.

import { LIMITS, REQUEST_ID } from './limits.js';
import { findMaterial, acceptedKind, addressRequired } from './model.js';

export function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}

const blank = v => !String(v == null ? '' : v).trim();

// Returns { problems: [{ field, lineKey?, message }], warnings: [...] }.
export function validateOrder(order, config) {
  const problems = [];
  const warnings = [];
  const c = order.customer;
  const add = (field, message, lineKey) => problems.push({ field, message, lineKey });

  if (blank(c.contact)) add('contact', 'Enter a contact name.');
  if (!isEmail(c.email)) add('email', 'Enter a valid email address.');
  if (addressRequired(c)) {
    if (blank(c.company)) add('company', 'Enter your company name.');
    if (blank(c.street)) add('street', 'Enter a street address.');
    if (blank(c.city)) add('city', 'Enter a city.');
    if (blank(c.state)) add('state', 'Enter a state.');
    if (blank(c.zip)) add('zip', 'Enter a zip code.');
  }

  if (!order.lines.length) add('lines', 'Add at least one part.');
  if (order.lines.length > LIMITS.maxLines) add('lines', `An order can have at most ${LIMITS.maxLines} parts. Please split it into more than one order.`);

  const byPart = new Map();
  order.lines.forEach((line, i) => {
    const n = `Part ${i + 1}`;
    if (blank(line.partNumber)) add('partNumber', `${n}: enter a part number.`, line.key);
    const mat = findMaterial(config, line.materialId);
    if (!mat) add('material', `${n}: choose a material.`, line.key);
    const qty = Number(line.qty);
    if (!Number.isInteger(qty) || qty < LIMITS.qtyMin || qty > LIMITS.qtyMax) add('qty', `${n}: quantity must be a whole number from ${LIMITS.qtyMin} to ${LIMITS.qtyMax}.`, line.key);
    if (line.materialId === REQUEST_ID && blank(line.notes)) add('notes', `${n}: describe the material you need in the notes.`, line.key);
    const kind = acceptedKind(config, line);
    if (line.file && kind && line.file.kind !== kind) {
      add('file', `${n}: this material needs a ${kind === 'dxf' ? 'DXF' : 'STEP'} file. Replace the attached ${line.file.kind === 'dxf' ? 'DXF' : 'STEP'} file.`, line.key);
    }
    if (!line.file) warnings.push({ lineKey: line.key, message: `${n}: no file attached. We will need a drawing or sketch.` });
    const pn = String(line.partNumber || '').trim().toLowerCase();
    if (pn) {
      if (byPart.has(pn)) warnings.push({ lineKey: line.key, message: `${n}: same part number as Part ${byPart.get(pn) + 1}.` });
      else byPart.set(pn, i);
    }
  });

  return { problems, warnings };
}
