// "Your information" section (ORDER_FORM_SCOPE.md §4.3), with the address rules Austin
// approved on 2026-10-08:
//  - link made for a known customer with 1 location → that address, prefilled
//  - several locations → the customer picks theirs
//  - either way, "address not listed" switches to typed address fields
//  - general link (no locations) → typed address required
// Typing updates the order in place (no re-render, so focus is never lost); only
// switching the address choice re-renders this section.

import { h, field } from './dom.js';
import { LIMITS } from './limits.js';
import { addressRequired } from './model.js';

function formatLocation(l) {
  return [l.street, [l.city, l.state].filter(Boolean).join(', '), l.zip].filter(Boolean).join(', ');
}

function textInput(customer, key, { type = 'text', max = LIMITS.text, autocomplete, inputmode, onChange }) {
  const input = h('input', {
    type, value: customer[key] || '', maxlength: max, autocomplete, inputmode, dataset: { field: key },
  });
  input.addEventListener('input', () => { customer[key] = input.value; onChange(); });
  return input;
}

export function renderCustomer(container, state, onChange) {
  const { config } = state;
  const c = state.order.customer;
  const needAddress = addressRequired(c);
  const rerender = () => { renderCustomer(container, state, onChange); onChange(); };
  const inp = (key, opts = {}) => textInput(c, key, { ...opts, onChange });

  const grid = h('div', { class: 'grid' }, [
    field('Company', inp('company', { autocomplete: 'organization' }), { required: needAddress }),
    field('Contact name', inp('contact', { autocomplete: 'name' }), { required: true }),
    field('Email', inp('email', { type: 'email', autocomplete: 'email', inputmode: 'email' }), { required: true }),
    field('Phone', inp('phone', { type: 'tel', autocomplete: 'tel', inputmode: 'tel' })),
    field('Your PO or reference', inp('po')),
    field('Needed by', inp('neededBy', { type: 'date', max: 10 })),
  ]);

  // Address
  const addressKids = [h('h3', { class: 'subhead', text: 'Address' })];
  if (config.locations.length) {
    const fieldset = h('fieldset', { class: 'choices' }, [
      h('legend', { class: 'label', text: config.locations.length > 1 ? 'Which location is this order for?' : 'Is this your address?' }),
    ]);
    const choice = (value, text) => {
      const radio = h('input', { type: 'radio', name: 'address-source', value, checked: c.addressSource === value });
      radio.addEventListener('change', () => { if (radio.checked) { c.addressSource = value; rerender(); } });
      return h('label', { class: 'choice' }, [radio, h('span', { text })]);
    };
    config.locations.forEach((l, i) => fieldset.appendChild(choice(`link-${i}`, formatLocation(l))));
    fieldset.appendChild(choice('entered', 'Address not listed (enter it below)'));
    addressKids.push(fieldset);
  }
  if (needAddress) {
    addressKids.push(h('div', { class: 'grid' }, [
      h('div', { class: 'span-2' }, field('Street', inp('street', { autocomplete: 'street-address' }), { required: true })),
      field('City', inp('city', { autocomplete: 'address-level2' }), { required: true }),
      field('State', inp('state', { autocomplete: 'address-level1' }), { required: true }),
      field('Zip code', inp('zip', { autocomplete: 'postal-code', inputmode: 'numeric' }), { required: true }),
    ]));
  }

  const notes = h('textarea', { rows: '3', maxlength: LIMITS.orderNotes, dataset: { field: 'notes' } });
  notes.value = c.notes || '';
  notes.addEventListener('input', () => { c.notes = notes.value; onChange(); });

  container.replaceChildren(
    h('h2', { text: 'Your information' }),
    grid,
    ...addressKids,
    field('Order notes', notes, { hint: 'Anything that applies to the whole order.' }),
  );
}
