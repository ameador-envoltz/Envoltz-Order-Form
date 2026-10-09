// Boot and orchestration: decode the link, restore the draft, mount the sections, autosave,
// and run Send (ORDER_FORM_SCOPE.md §4).

import { h } from './dom.js';
import { decodeConfigFromHash, validateConfig, DEMO_CONFIG } from './config.js';
import { FORM_VERSION, LIMITS, REQUEST_ID } from './limits.js';
import { createOrder, newLine, partNumberFromFileName } from './model.js';
import { validateOrder } from './validate.js';
import { fileMeta, checkFile, formatBytes } from './files.js';
import { draftKey, loadDraft, saveDraft, saveFile, loadFile, removeFile, clearDraft } from './draft.js';
import { packOrder, orderFileName } from './pack.js';
import { downloadBlob } from './share.js';
import { renderCustomer } from './ui-header.js';
import { renderLines } from './ui-lines.js';
import { renderSendBar, renderProblems, renderNotice, renderNextStep } from './ui-sendbar.js';

const $ = id => document.getElementById(id);

const state = {
  config: null,
  order: null,
  files: new Map(), // line key → File/Blob (the bytes; the order only holds metadata)
  key: '',
  triedSend: false,
  storageOk: true,
};

// --- config -------------------------------------------------------------------------

function readConfig() {
  if (location.hash === '#demo') return { ok: true, config: validateConfig(DEMO_CONFIG) };
  return decodeConfigFromHash(location.hash);
}

function showIncomplete() {
  document.title = 'Order form';
  $('app').replaceChildren(h('section', { class: 'card incomplete' }, [
    h('h1', { text: 'This link is incomplete' }),
    h('p', { text: 'Please ask Envoltz for a new order link.' }),
  ]));
  $('sendbar').hidden = true;
}

// --- draft --------------------------------------------------------------------------

// A saved draft is device data, but treat it carefully anyway: keep only known fields.
function restoreOrder(saved) {
  const base = createOrder(state.config);
  if (!saved || typeof saved !== 'object') return base;
  const c = saved.customer || {};
  Object.keys(base.customer).forEach(k => { if (typeof c[k] === 'string') base.customer[k] = c[k]; });
  if (!/^(entered|link-\d+)$/.test(base.customer.addressSource) ||
      (/^link-(\d+)$/.test(base.customer.addressSource) && !state.config.locations[Number(base.customer.addressSource.slice(5))])) {
    base.customer.addressSource = state.config.locations.length ? 'link-0' : 'entered';
  }
  if (base.customer.emailSource !== 'entered' &&
      !(base.customer.emailSource === 'list' && state.config.emails.includes(base.customer.email))) {
    base.customer.emailSource = state.config.emails.length ? 'list' : 'entered';
    if (state.config.emails.length) base.customer.email = state.config.emails[0];
  }
  base.lines = (Array.isArray(saved.lines) ? saved.lines : []).slice(0, LIMITS.maxLines).map(l => ({
    key: typeof l.key === 'string' ? l.key : newLine().key,
    partNumber: typeof l.partNumber === 'string' ? l.partNumber : '',
    materialId: typeof l.materialId === 'string' && (l.materialId === REQUEST_ID || state.config.materials.some(m => m.id === l.materialId)) ? l.materialId : '',
    qty: Number.isFinite(Number(l.qty)) ? l.qty : 1,
    notes: typeof l.notes === 'string' ? l.notes : '',
    file: l.file && typeof l.file.name === 'string' ? { name: l.file.name, size: Number(l.file.size) || 0, lastModified: Number(l.file.lastModified) || 0, kind: l.file.kind } : null,
  }));
  return base;
}

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    state.storageOk = saveDraft(state.key, state.order);
    $('draft-status').textContent = state.storageOk
      ? 'Draft saved on this device.'
      : "Autosave isn't available in this browser. Keep this page open until you send.";
  }, 400);
}

// --- validation display ---------------------------------------------------------------

function refreshValidation() {
  const { problems, warnings } = validateOrder(state.order, state.config);
  // Field highlights only after a Send attempt, so a fresh form isn't covered in red.
  document.querySelectorAll('[aria-invalid="true"]').forEach(el => el.removeAttribute('aria-invalid'));
  document.querySelectorAll('.line.has-problem').forEach(el => el.classList.remove('has-problem'));
  document.querySelectorAll('.line-messages').forEach(el => el.replaceChildren());
  if (state.triedSend) {
    problems.forEach(p => {
      const scope = p.lineKey ? document.querySelector(`.line[data-line-key="${CSS.escape(p.lineKey)}"]`) : $('customer');
      if (!scope) return;
      if (p.lineKey) scope.classList.add('has-problem');
      const input = scope.querySelector(`[data-field="${p.field}"]`);
      if (input) input.setAttribute('aria-invalid', 'true');
    });
    renderProblems($('problems'), problems);
  }
  // Wrong-kind file errors show right away (they come from an action the customer just took).
  problems.filter(p => p.field === 'file').forEach(p => {
    const line = document.querySelector(`.line[data-line-key="${CSS.escape(p.lineKey)}"] .line-messages`);
    if (line) line.appendChild(h('div', { class: 'field-error', text: p.message }));
  });
  warnings.forEach(w => {
    if (!w.lineKey || /no file attached/.test(w.message)) return; // shown in the file box already
    const line = document.querySelector(`.line[data-line-key="${CSS.escape(w.lineKey)}"] .line-messages`);
    if (line) line.appendChild(h('div', { class: 'hint warn', text: w.message.replace(/^Part \d+: /, '') }));
  });
  return problems;
}

function changed() {
  scheduleSave();
  refreshValidation();
  renderSendBar($('sendbar'), state, send);
}

// --- files --------------------------------------------------------------------------

function notice(messages) {
  const el = $('file-notice');
  if (!el) return;
  el.replaceChildren(...messages.map(m => h('div', { class: m.error ? 'field-error' : 'hint warn', text: m.text })));
}

function attachedMetas(exceptKey) {
  return state.order.lines.filter(l => l.file && l.key !== exceptKey).map(l => l.file);
}

async function attach(line, file) {
  line.file = fileMeta(file);
  state.files.set(line.key, file);
  await saveFile(state.key, line.key, file);
}

async function addFiles(fileList) {
  const msgs = [];
  for (const file of fileList) {
    if (state.order.lines.length >= LIMITS.maxLines) { msgs.push({ error: true, text: `An order can have at most ${LIMITS.maxLines} parts.` }); break; }
    const meta = fileMeta(file);
    const check = checkFile(meta, attachedMetas());
    if (!check.ok) { msgs.push({ error: true, text: check.error }); continue; }
    if (check.warning) msgs.push({ text: check.warning });
    const line = newLine({ partNumber: partNumberFromFileName(file.name) });
    state.order.lines.push(line);
    await attach(line, file);
  }
  renderParts();
  notice(msgs);
  changed();
}

let pendingFileFor = null;
function pickFileFor(lineKey) {
  pendingFileFor = lineKey;
  $('single-picker').click();
}

async function onSinglePicked(file) {
  const line = state.order.lines.find(l => l.key === pendingFileFor);
  pendingFileFor = null;
  if (!line || !file) return;
  const meta = fileMeta(file);
  const check = checkFile(meta, attachedMetas(line.key));
  if (!check.ok) { notice([{ error: true, text: check.error }]); return; }
  await attach(line, file);
  if (!line.partNumber) line.partNumber = partNumberFromFileName(file.name);
  renderParts();
  notice(check.warning ? [{ text: check.warning }] : []);
  changed();
}

async function removeFileFrom(lineKey) {
  const line = state.order.lines.find(l => l.key === lineKey);
  if (!line) return;
  line.file = null;
  state.files.delete(lineKey);
  await removeFile(state.key, lineKey);
  renderParts();
  changed();
}

// --- lines --------------------------------------------------------------------------

const lineHandlers = {
  changed,
  addFiles,
  pickFileFor,
  removeFile: removeFileFrom,
  addManual() {
    if (state.order.lines.length >= LIMITS.maxLines) return;
    state.order.lines.push(newLine());
    renderParts();
    changed();
  },
  removeLine(lineKey) {
    state.order.lines = state.order.lines.filter(l => l.key !== lineKey);
    state.files.delete(lineKey);
    removeFile(state.key, lineKey);
    renderParts();
    changed();
  },
  setMaterial(lineKey, id) {
    const line = state.order.lines.find(l => l.key === lineKey);
    if (!line) return;
    line.materialId = id;
    renderParts();
    changed();
  },
};

function renderParts() {
  renderLines($('parts'), state, lineHandlers);
}

// --- send ---------------------------------------------------------------------------

let sizeAcknowledged = false;

async function send() {
  state.triedSend = true;
  const problems = refreshValidation();
  if (problems.length) {
    $('problems').focus();
    $('problems').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  renderProblems($('problems'), []);
  const btn = $('send-btn');
  btn.disabled = true;
  btn.textContent = 'Preparing…';
  try {
    const bytes = new Map();
    for (const line of state.order.lines) {
      if (!line.file) continue;
      const blob = state.files.get(line.key);
      if (!blob) throw new Error(`The file for "${line.partNumber}" is no longer on this device. Please attach it again.`);
      bytes.set(line.key, new Uint8Array(await blob.arrayBuffer()));
    }
    const { zip } = packOrder(state.order, state.config, bytes);
    const fileName = orderFileName(state.order);
    const sizeText = formatBytes(zip.length);

    if (zip.length > LIMITS.maxOrderBytes) {
      renderNotice($('send-notice'), `This order file is ${sizeText}, which is too large to email. Please send fewer parts per order (split it into two or more orders).`, { tone: 'error' });
      return;
    }
    if (zip.length > LIMITS.warnOrderBytes && !sizeAcknowledged) {
      renderNotice($('send-notice'), `This order file is ${sizeText}. Some email systems won't accept attachments this large. You can send fewer parts per order, or download it anyway.`, {
        actionText: 'Download anyway', onAction: () => { sizeAcknowledged = true; send(); },
      });
      return;
    }
    renderNotice($('send-notice'), null);

    downloadBlob(new Blob([zip], { type: 'application/zip' }), fileName);
    renderNextStep($('next-step'), {
      fileName, sizeText, returnEmail: state.config.returnEmail,
      onDone: () => { $('next-step').hidden = true; },
    });
    $('next-step').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {
    renderNotice($('send-notice'), e.message, { tone: 'error' });
  } finally {
    btn.disabled = false;
    btn.textContent = 'Download completed order form';
  }
}

// --- boot ---------------------------------------------------------------------------

async function startOver() {
  if (!confirm('Clear this order and start over? Everything on this form, including attached files, will be removed from this device.')) return;
  await clearDraft(state.key, state.order.lines.map(l => l.key));
  state.order = createOrder(state.config);
  state.files.clear();
  state.triedSend = false;
  mount();
}

function mount() {
  const { config } = state;
  document.title = `Order / Request for Quote · ${config.company}`;
  $('company-name').textContent = config.company;
  $('intro').textContent = config.message;
  $('intro').hidden = !config.message;
  renderCustomer($('customer'), state, changed);
  renderParts();
  renderSendBar($('sendbar'), state, send);
  renderProblems($('problems'), []);
  refreshValidation();
}

async function boot() {
  $('form-version').textContent = `Form v${FORM_VERSION}`;
  const res = readConfig();
  if (!res.ok) { showIncomplete(); return; }
  state.config = res.config;
  $('link-stamp').textContent = res.config.stamp ? `Link created ${res.config.stamp.replace('T', ' ')}` : '';
  state.key = draftKey(res.config.stamp);
  const saved = loadDraft(state.key);
  state.order = restoreOrder(saved);
  // Bring back attached files from the device; any that are gone become "attach again".
  for (const line of state.order.lines) {
    if (!line.file) continue;
    const blob = await loadFile(state.key, line.key);
    if (blob) state.files.set(line.key, blob);
    else line.file = null;
  }

  const single = $('single-picker');
  single.addEventListener('change', () => { onSinglePicked(single.files[0]); single.value = ''; });
  $('start-over').addEventListener('click', startOver);
  mount();
  if (saved && (state.order.lines.length || state.order.customer.contact)) {
    $('draft-status').textContent = 'Your draft from earlier was restored on this device.';
  }
}

// Opening a different order link in an already-open tab only changes the part after "#",
// which browsers don't reload for. Start fresh with the new link.
window.addEventListener('hashchange', () => location.reload());

boot();
