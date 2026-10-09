// Decodes and validates the link configuration (ORDER_FORM_SCOPE.md §4.2, §6.1).
// URL: <page>#c=<base64url(deflate-raw(JSON))>. Pure: no DOM.
//
// The config is UNTRUSTED (anyone can edit a URL): every field is type-checked, trimmed,
// length-limited and stripped of control characters. Unknown fields are dropped. A config
// that fails is rejected outright; materials are never invented.

import { inflateSync, strFromU8 } from '../vendor/fflate.js';
import { LIMITS, MATERIAL_TYPES } from './limits.js';

// Control characters except tab/newline (kept for the intro message).
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanText(v, max, { multiline = false } = {}) {
  if (v == null) return '';
  let s = String(v).replace(CONTROL, '');
  if (!multiline) s = s.replace(/[\r\n\t]+/g, ' ');
  return s.trim().slice(0, max);
}

export function base64UrlToBytes(str) {
  if (!/^[A-Za-z0-9_-]*$/.test(str)) throw new Error('not base64url');
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Returns a clean config object, or throws with a short reason.
export function validateConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('not an object');
  if (raw.v !== 1) throw new Error('unsupported version');
  if (!Array.isArray(raw.mats)) throw new Error('no materials');

  const mats = [];
  const seen = new Set();
  for (const m of raw.mats.slice(0, LIMITS.configMaterials)) {
    if (!m || typeof m !== 'object') continue;
    const id = cleanText(m.id, LIMITS.configId);
    const label = cleanText(m.l, LIMITS.configLabel);
    const type = typeof m.t === 'string' && Object.prototype.hasOwnProperty.call(MATERIAL_TYPES, m.t) ? m.t : null;
    if (!id || !label || !type || seen.has(id)) continue;
    seen.add(id);
    mats.push({ id, label, type });
  }
  if (!mats.length) throw new Error('no valid materials');

  const pre = raw.pre && typeof raw.pre === 'object' ? raw.pre : {};
  const locations = (Array.isArray(raw.locs) ? raw.locs : []).slice(0, LIMITS.configLocations)
    .filter(l => l && typeof l === 'object')
    .map(l => ({
      street: cleanText(l.st, LIMITS.text), city: cleanText(l.ci, LIMITS.text),
      state: cleanText(l.sa, LIMITS.text), zip: cleanText(l.zp, LIMITS.text),
    }))
    .filter(l => l.street || l.city || l.zip);

  // The customer's emails from the quoter's Customers tab (only on a link made for a known
  // customer). A contact email prefilled for this link comes first.
  const emailRe = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;
  const seenEmail = new Set();
  const emails = [pre.email, ...(Array.isArray(raw.ems) ? raw.ems.slice(0, 20) : [])]
    .map(e => cleanText(e, LIMITS.text))
    .filter(e => emailRe.test(e) && !seenEmail.has(e.toLowerCase()) && seenEmail.add(e.toLowerCase()));

  return {
    stamp: cleanText(raw.stamp, 40),
    emails,
    company: cleanText(raw.co, LIMITS.text) || 'Envoltz',
    returnEmail: cleanText(raw.to, LIMITS.text),
    message: cleanText(raw.msg, LIMITS.configMessage, { multiline: true }),
    quoteRef: cleanText(raw.ref, LIMITS.text),
    prefill: {
      company: cleanText(pre.company, LIMITS.text),
      contact: cleanText(pre.contact, LIMITS.text),
      email: cleanText(pre.email, LIMITS.text),
      phone: cleanText(pre.phone, LIMITS.text),
    },
    locations,
    materials: mats,
  };
}

// hash: location.hash ("#c=..."). Returns { ok: true, config } or { ok: false, reason }.
export function decodeConfigFromHash(hash) {
  const m = /^#c=([A-Za-z0-9_-]+)$/.exec(String(hash || '').trim());
  if (!m) return { ok: false, reason: 'missing' };
  try {
    const json = strFromU8(inflateSync(base64UrlToBytes(m[1])));
    if (json.length > 200000) throw new Error('too large');
    return { ok: true, config: validateConfig(JSON.parse(json)) };
  } catch (e) {
    return { ok: false, reason: 'corrupt: ' + e.message };
  }
}

// Development only: #demo loads a built-in sample config (ORDER_FORM_SCOPE.md §4.2).
export const DEMO_CONFIG = {
  v: 1, stamp: 'demo', co: 'Envoltz Fabrication', to: 'orders@example.com',
  msg: 'Attach your DXF or STEP files and choose a material and quantity for each part.',
  ref: '', pre: { company: '', contact: '', email: '', phone: '' }, svc: false, locs: [],
  mats: [
    { id: 'demo-1', l: '16GA Steel A36 HR P&O', t: 'sheet' },
    { id: 'demo-2', l: '1/4" Steel A36 HR P&O', t: 'sheet' },
    { id: 'demo-3', l: '1/8" Aluminum 5052 H32 Rolled', t: 'sheet' },
    { id: 'demo-4', l: '2" x 2" x .125" Steel A500B', t: 'sqtube' },
    { id: 'demo-5', l: 'Ø4" Sch 40 Steel A53', t: 'pipe' },
    { id: 'demo-6', l: '4" x 4" x 1/4" Steel A36', t: 'angle' },
  ],
};
