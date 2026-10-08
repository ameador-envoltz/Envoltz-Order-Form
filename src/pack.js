// Builds order.json and the order .zip (ORDER_FORM_SCOPE.md §4.7, §6.2, plus the
// 2026-10-08 contract additions in fab-quoter V2's CLAUDE.md: customer address fields and
// "Request in notes" lines). Pure given its inputs: no DOM, no network.

import { zipSync, strToU8 } from '../vendor/fflate.js';
import { FORM_VERSION, ORDER_FORMAT, SCHEMA_VERSION, REQUEST_ID, REQUEST_LABEL, LIMITS } from './limits.js';
import { findMaterial, effectiveAddress } from './model.js';
import { cleanText } from './config.js';

export function randomId(len = 8) {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map(b => abc[b % abc.length]).join('');
}

// Letters, digits, dashes and underscores only.
export function safeName(s, fallback) {
  const out = String(s || '').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return out || fallback;
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Order_<Company-or-Contact>_<YYYY-MM-DD>.zip
export function orderFileName(order, now = new Date()) {
  const who = safeName(order.customer.company || order.customer.contact, 'Order');
  return `Order_${who}_${isoDate(now)}.zip`;
}

// Archive path for a line's file: files/<NNN>_<safe original name>.<ext>
export function archivePath(lineNo, fileName, kind) {
  const base = safeName(String(fileName).replace(/\.[^.]+$/, ''), 'part');
  return `files/${String(lineNo).padStart(3, '0')}_${base}.${kind === 'dxf' ? 'dxf' : 'step'}`;
}

export function buildOrderJson(order, config, { now = new Date(), orderId = randomId() } = {}) {
  const c = order.customer;
  const addr = effectiveAddress(config, c);
  const t = (v, n = LIMITS.text) => cleanText(v, n);
  return {
    format: ORDER_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    formVersion: FORM_VERSION,
    createdAt: now.toISOString(),
    configStamp: config.stamp || '',
    orderId,
    customer: {
      company: t(c.company), contact: t(c.contact), email: t(c.email), phone: t(c.phone),
      po: t(c.po), neededBy: t(c.neededBy, 10), notes: cleanText(c.notes, LIMITS.orderNotes, { multiline: true }),
      street: t(addr.street), city: t(addr.city), state: t(addr.state), zip: t(addr.zip),
      addressSource: addr.source, // 'link' (a location the link offered) or 'entered'
    },
    lines: order.lines.map((line, i) => {
      const mat = findMaterial(config, line.materialId);
      const isRequest = line.materialId === REQUEST_ID;
      return {
        lineNo: i + 1,
        partNumber: t(line.partNumber, LIMITS.partNumber),
        materialId: isRequest || !mat ? null : mat.id,
        materialLabel: isRequest ? REQUEST_LABEL : (mat ? mat.label : ''),
        materialType: isRequest || !mat ? null : mat.type,
        qty: Number(line.qty),
        notes: cleanText(line.notes, LIMITS.lineNotes, { multiline: true }),
        file: line.file ? {
          path: archivePath(i + 1, line.file.name, line.file.kind),
          originalName: t(line.file.name, 255),
          kind: line.file.kind,
          size: line.file.size,
          lastModified: line.file.lastModified,
        } : null,
      };
    }),
  };
}

// Plain-text summary for whoever opens the zip by hand. Ignored by the quoter.
export function buildSummary(orderJson) {
  const c = orderJson.customer;
  const lines = [
    `Order ${orderJson.orderId}  (${orderJson.createdAt})`,
    `${c.company}`, `${c.contact}  ${c.email}  ${c.phone}`.trim(),
    [c.street, [c.city, c.state].filter(Boolean).join(', '), c.zip].filter(Boolean).join(', '),
    c.po ? `PO / reference: ${c.po}` : '', c.neededBy ? `Needed by: ${c.neededBy}` : '',
    c.notes ? `Notes: ${c.notes}` : '', '',
  ];
  orderJson.lines.forEach(l => {
    lines.push(`${String(l.lineNo).padStart(3, '0')}  ${l.partNumber}  x${l.qty}  ${l.materialLabel}${l.file ? '  [' + l.file.originalName + ']' : '  [no file]'}`);
    if (l.notes) lines.push(`     ${l.notes.replace(/\n/g, ' ')}`);
  });
  return lines.join('\r\n');
}

// files: Map(lineKey → Uint8Array). Returns Uint8Array of the zip.
export function packOrder(order, config, fileBytesByKey, opts) {
  const orderJson = buildOrderJson(order, config, opts);
  const entries = {
    'order.json': strToU8(JSON.stringify(orderJson, null, 2)),
    'summary.txt': strToU8(buildSummary(orderJson)),
  };
  orderJson.lines.forEach((l, i) => {
    if (!l.file) return;
    const bytes = fileBytesByKey.get(order.lines[i].key);
    if (!bytes) throw new Error(`The file for part ${i + 1} (${l.file.originalName}) is missing. Please attach it again.`);
    entries[l.file.path] = bytes;
  });
  return { zip: zipSync(entries, { level: 6 }), orderJson };
}
