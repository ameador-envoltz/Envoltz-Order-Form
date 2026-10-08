// Parts list (ORDER_FORM_SCOPE.md §4.3): one card per line, stacked on phones and laid out
// as a row on wider screens (CSS). Typing updates the line in place; structural changes
// (add/remove, material, file) re-render the list.

import { h, field } from './dom.js';
import { LIMITS, MATERIAL_TYPES, REQUEST_ID, REQUEST_LABEL, ACCEPT, fileKindFor } from './limits.js';
import { formatBytes } from './files.js';

// Dropdown: grouped by type in the link's order; a line with a file only shows materials
// that take that file kind. "Request in notes" is always the last option.
function materialSelect(config, line, onPick) {
  const select = h('select', { dataset: { field: 'material' } });
  select.appendChild(h('option', { value: '', text: 'Choose a material…' }));
  const fileKind = line.file ? line.file.kind : null;
  Object.entries(MATERIAL_TYPES).forEach(([type, groupLabel]) => {
    const holdsCurrent = config.materials.some(m => m.id === line.materialId && m.type === type);
    if (fileKind && fileKindFor(type) !== fileKind && !holdsCurrent) return;
    const mats = config.materials.filter(m => m.type === type);
    if (!mats.length) return;
    const group = h('optgroup', { label: groupLabel });
    mats.forEach(m => group.appendChild(h('option', { value: m.id, text: m.label })));
    select.appendChild(group);
  });
  select.appendChild(h('option', { value: REQUEST_ID, text: REQUEST_LABEL + ' (describe it below)' }));
  select.value = line.materialId || '';
  select.addEventListener('change', () => onPick(select.value));
  return select;
}

function fileBlock(line, handlers) {
  if (!line.file) {
    return h('div', { class: 'file-box empty' }, [
      h('button', { type: 'button', class: 'btn small', text: 'Attach file', onclick: () => handlers.pickFileFor(line.key) }),
      h('div', { class: 'hint warn', text: 'No file attached. We will need a drawing or sketch.' }),
    ]);
  }
  return h('div', { class: 'file-box' }, [
    h('div', { class: 'file-name', text: line.file.name }),
    h('div', { class: 'hint', text: `${line.file.kind === 'dxf' ? 'DXF' : 'STEP'} · ${formatBytes(line.file.size)}` }),
    h('div', { class: 'row-actions' }, [
      h('button', { type: 'button', class: 'btn-link', text: 'Replace', onclick: () => handlers.pickFileFor(line.key) }),
      h('button', { type: 'button', class: 'btn-link', text: 'Remove file', onclick: () => handlers.removeFile(line.key) }),
    ]),
  ]);
}

function lineCard(state, line, index, handlers) {
  const { config } = state;
  const isRequest = line.materialId === REQUEST_ID;

  const pn = h('input', { type: 'text', value: line.partNumber, maxlength: LIMITS.partNumber, dataset: { field: 'partNumber' } });
  pn.addEventListener('input', () => { line.partNumber = pn.value; handlers.changed(); });

  const qty = h('input', { type: 'text', inputmode: 'numeric', pattern: '[0-9]*', value: String(line.qty), dataset: { field: 'qty' } });
  qty.addEventListener('input', () => {
    const digits = qty.value.replace(/\D+/g, '');
    if (digits !== qty.value) qty.value = digits;
    line.qty = digits === '' ? '' : Number(digits);
    handlers.changed();
  });

  const notes = h('textarea', { rows: '2', maxlength: LIMITS.lineNotes, dataset: { field: 'notes' } });
  notes.value = line.notes || '';
  notes.placeholder = isRequest ? 'Describe the material you need (type, size, grade…)' : 'Optional';
  const counter = h('div', { class: 'hint counter' });
  const updateCounter = () => { counter.textContent = `${notes.value.length}/${LIMITS.lineNotes}`; };
  updateCounter();
  notes.addEventListener('input', () => { line.notes = notes.value; updateCounter(); handlers.changed(); });

  const select = materialSelect(config, line, value => handlers.setMaterial(line.key, value));

  return h('section', { class: 'line', dataset: { lineKey: line.key }, 'aria-label': `Part ${index + 1}` }, [
    h('div', { class: 'line-head' }, [
      h('div', { class: 'line-title', text: `Part ${index + 1}` }),
      h('button', { type: 'button', class: 'btn-link danger', text: 'Remove part', onclick: () => handlers.removeLine(line.key) }),
    ]),
    h('div', { class: 'line-grid' }, [
      h('div', { class: 'c-part' }, field('Part number', pn, { required: true })),
      h('div', { class: 'c-mat' }, field('Material', select, { required: true })),
      h('div', { class: 'c-qty' }, field('Quantity', qty, { required: true })),
      h('div', { class: 'c-file' }, [h('div', { class: 'label', text: 'File' }), fileBlock(line, handlers)]),
      h('div', { class: 'c-notes' }, [field(isRequest ? 'Notes (required for a requested material)' : 'Notes', notes, { required: isRequest }), counter]),
    ]),
    h('div', { class: 'line-messages', 'aria-live': 'polite' }),
  ]);
}

export function renderLines(container, state, handlers) {
  const picker = h('input', { type: 'file', accept: ACCEPT, multiple: true, class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });
  picker.addEventListener('change', () => { handlers.addFiles([...picker.files]); picker.value = ''; });

  const drop = h('div', { class: 'dropzone' }, [
    h('div', { class: 'drop-title', text: 'Add your DXF or STEP files' }),
    h('div', { class: 'hint', text: 'Each file becomes one part. Flat parts: DXF. Tube, pipe and angle: STEP.' }),
    h('div', { class: 'row-actions' }, [
      h('button', { type: 'button', class: 'btn primary', text: 'Add DXF/STEP files', onclick: () => picker.click() }),
      h('button', { type: 'button', class: 'btn', text: 'Add part without a file', onclick: () => handlers.addManual() }),
    ]),
    picker,
  ]);
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => { e.preventDefault(); handlers.addFiles([...(e.dataTransfer?.files || [])]); });

  const list = h('div', { class: 'lines' });
  state.order.lines.forEach((line, i) => list.appendChild(lineCard(state, line, i, handlers)));

  container.replaceChildren(
    h('h2', { text: 'Parts' }),
    drop,
    h('div', { class: 'notice', id: 'file-notice', 'aria-live': 'polite' }),
    list,
  );
}
