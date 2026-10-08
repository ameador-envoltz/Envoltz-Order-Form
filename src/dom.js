// Tiny DOM helpers. Text is only ever set with textContent (never innerHTML), and no
// inline `style` attributes are used (the page's Content-Security-Policy forbids them),
// so config strings and file names can't inject markup.

export function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'value') node.value = v;
    else if (k === 'checked') node.checked = !!v;
    else if (k === 'style') throw new Error('inline styles are not allowed (CSP)');
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

let idSeq = 0;
export function uid(prefix = 'f') {
  idSeq += 1;
  return `${prefix}-${idSeq}`;
}

// A labelled field. `control` gets an id, and the label points at it.
export function field(labelText, control, { required = false, hint = null, error = null } = {}) {
  if (!control.id) control.id = uid();
  const kids = [
    h('label', { for: control.id, class: 'label' }, [labelText, required ? h('span', { class: 'req', 'aria-hidden': 'true', text: '*' }) : null]),
    control,
  ];
  if (hint) kids.push(h('div', { class: 'hint', text: hint }));
  if (error) {
    control.setAttribute('aria-invalid', 'true');
    kids.push(h('div', { class: 'field-error', text: error }));
  }
  return h('div', { class: 'field' + (error ? ' has-error' : '') }, kids);
}
