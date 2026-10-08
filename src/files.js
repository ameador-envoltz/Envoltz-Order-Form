// File intake: extension and size checks, duplicate detection (ORDER_FORM_SCOPE.md §4.3,
// §4.5). Pure apart from reading File metadata (name/size/lastModified). No parsing: the
// quoter parses every file on import.

import { EXTENSIONS, LIMITS } from './limits.js';

export function extensionOf(name) {
  const m = /\.[^.\\/]+$/.exec(String(name || ''));
  return m ? m[0].toLowerCase() : '';
}

// 'dxf' | 'step' | null. Pickers on some phones ignore `accept`, so every file is
// checked by extension after it's chosen.
export function kindOf(name) {
  return EXTENSIONS[extensionOf(name)] || null;
}

export function fileMeta(file) {
  return { name: String(file.name), size: Number(file.size) || 0, lastModified: Number(file.lastModified) || 0, kind: kindOf(file.name) };
}

// Same name, size and modified time = the same file.
export function sameFile(a, b) {
  return !!a && !!b && a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

export function formatBytes(n) {
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
  if (n >= 1024) return Math.round(n / 1024) + ' KB';
  return n + ' B';
}

// Checks one file against the rules. Returns { ok, error?, warning? }.
export function checkFile(meta, existingMetas) {
  if (!meta.kind) return { ok: false, error: `${meta.name}: only DXF and STEP files can be attached.` };
  if (meta.size <= 0) return { ok: false, error: `${meta.name}: the file is empty.` };
  if (meta.size > LIMITS.maxFileBytes) return { ok: false, error: `${meta.name}: larger than ${formatBytes(LIMITS.maxFileBytes)}. Please send this one separately.` };
  if (existingMetas.some(m => sameFile(m, meta))) return { ok: false, error: `${meta.name}: this file is already attached.` };
  return { ok: true, warning: meta.size > LIMITS.warnFileBytes ? `${meta.name} is large (${formatBytes(meta.size)}).` : null };
}
