// Sticky footer (line count, attached size, Send), the problems panel, and the "next step"
// panel shown after the order file is shared or downloaded (ORDER_FORM_SCOPE.md §4.3, §4.7).

import { h } from './dom.js';
import { formatBytes } from './files.js';

export function renderSendBar(bar, state, onSend) {
  const n = state.order.lines.length;
  const bytes = state.order.lines.reduce((s, l) => s + (l.file ? l.file.size : 0), 0);
  bar.replaceChildren(
    h('div', { class: 'sendbar-info' }, [
      h('strong', { text: `${n} part${n === 1 ? '' : 's'}` }),
      h('span', { class: 'hint', text: ` · ${formatBytes(bytes)} attached` }),
    ]),
    h('button', { type: 'button', class: 'btn primary', id: 'send-btn', text: 'Download completed order form', onclick: onSend }),
  );
}

export function renderProblems(panel, problems) {
  if (!problems.length) { panel.replaceChildren(); panel.hidden = true; return; }
  panel.hidden = false;
  panel.replaceChildren(
    h('div', { class: 'panel-title', text: `Please fix ${problems.length === 1 ? 'this' : `these ${problems.length} things`} before sending:` }),
    h('ul', {}, problems.map(p => h('li', { text: p.message }))),
  );
}

// Notice before sharing (e.g. large file), with an optional "Send anyway" button.
export function renderNotice(panel, message, { actionText, onAction, tone = 'warn' } = {}) {
  if (!message) { panel.replaceChildren(); panel.hidden = true; return; }
  panel.hidden = false;
  panel.className = 'panel ' + tone;
  panel.replaceChildren(
    h('div', { text: message }),
    actionText ? h('button', { type: 'button', class: 'btn small', text: actionText, onclick: onAction }) : null,
  );
}

// After the download (Austin, 2026-10-09): attach the file to your email to us. Never says
// "sent": the form can't know.
export function renderNextStep(panel, { fileName, returnEmail, sizeText, onDone }) {
  panel.hidden = false;
  panel.className = 'panel next';
  const kids = [
    h('div', { class: 'panel-title', text: 'Next step: attach this file to your email to us' }),
    h('p', {}, ['Your completed order form was downloaded: ', h('strong', { text: fileName }), ` (${sizeText}).`]),
    h('ol', { class: 'steps' }, [
      h('li', { text: 'Replying to an email from us? Attach the downloaded file to that reply.' }),
      h('li', { text: 'Starting a new email? Attach the file and send it to the address below.' }),
    ]),
  ];
  if (returnEmail) {
    const copy = h('button', { type: 'button', class: 'btn small', text: 'Copy address' });
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(returnEmail); copy.textContent = 'Copied'; } catch { copy.textContent = 'Copy failed'; }
    });
    kids.push(h('p', { class: 'address-row' }, ['Our address: ', h('strong', { text: returnEmail }), ' ', copy]));
  }
  kids.push(h('p', { class: 'hint', text: "Can't find the file? Look in your Downloads folder (on most phones and tablets: the Files app → Downloads)." }));
  kids.push(h('p', { class: 'hint', text: 'Your draft is kept on this device until you clear it with Start over.' }));
  kids.push(h('button', { type: 'button', class: 'btn small', text: 'Close', onclick: onDone }));
  panel.replaceChildren(...kids);
}
