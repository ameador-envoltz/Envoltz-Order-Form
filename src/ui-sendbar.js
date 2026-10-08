// Sticky footer (line count, attached size, Send), the problems panel, and the "next step"
// panel shown after the order file is shared or downloaded (ORDER_FORM_SCOPE.md §4.3, §4.7).

import { h } from './dom.js';
import { formatBytes } from './files.js';
import { mailtoLink } from './share.js';

export function renderSendBar(bar, state, onSend) {
  const n = state.order.lines.length;
  const bytes = state.order.lines.reduce((s, l) => s + (l.file ? l.file.size : 0), 0);
  bar.replaceChildren(
    h('div', { class: 'sendbar-info' }, [
      h('strong', { text: `${n} part${n === 1 ? '' : 's'}` }),
      h('span', { class: 'hint', text: ` · ${formatBytes(bytes)} attached` }),
    ]),
    h('button', { type: 'button', class: 'btn primary', id: 'send-btn', text: 'Send order', onclick: onSend }),
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

// After the share sheet or a download. Never says "sent": the form can't know.
export function renderNextStep(panel, result, { fileName, returnEmail, company, sizeText, onDone }) {
  panel.hidden = false;
  panel.className = 'panel next';
  const kids = [h('div', { class: 'panel-title', text: 'Next step' })];
  if (result === 'shared') {
    kids.push(h('p', { text: `Your order file (${fileName}, ${sizeText}) was handed to the app you picked.` }));
    kids.push(h('p', { text: returnEmail ? `Make sure the message goes to ${returnEmail} and that you sent it.` : 'Make sure you sent the message.' }));
  } else {
    kids.push(h('p', { text: `Your order file was downloaded: ${fileName} (${sizeText}).` }));
    if (returnEmail) {
      const copy = h('button', { type: 'button', class: 'btn small', text: 'Copy address' });
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(returnEmail); copy.textContent = 'Copied'; } catch { copy.textContent = 'Copy failed'; }
      });
      kids.push(h('p', {}, ['Email it to ', h('strong', { text: returnEmail }), ' ', copy]));
      const subject = `Order: ${company || fileName}`;
      kids.push(h('p', {}, [
        h('a', { href: mailtoLink(returnEmail, subject, `Please find my order attached (${fileName}).`), text: 'Start an email' }),
        h('span', { class: 'hint', text: ' (opens your email program; it cannot attach the file for you, so attach the downloaded file to it)' }),
      ]));
    } else {
      kids.push(h('p', { text: 'Attach it to an email to us.' }));
    }
  }
  kids.push(h('p', { class: 'hint', text: 'Your draft is kept on this device until you clear it with Start over.' }));
  kids.push(h('button', { type: 'button', class: 'btn small', text: 'Close', onclick: onDone }));
  panel.replaceChildren(...kids);
}
