// Every limit and fixed value the form uses, in one place (ORDER_FORM_SCOPE.md §4.5).

export const FORM_VERSION = '1.2.0';
export const ORDER_FORMAT = 'envoltz-fab-order';
export const SCHEMA_VERSION = 1;

const MB = 1024 * 1024;

export const LIMITS = {
  maxLines: 200,
  maxFileBytes: 25 * MB,
  warnFileBytes: 5 * MB,
  // Size of the finished order file (after zipping). Most email systems reject attachments
  // over about 20–25 MB, so above 20 MB the customer is asked to split the order.
  warnOrderBytes: 15 * MB,
  maxOrderBytes: 20 * MB,
  partNumber: 80,
  lineNotes: 500,
  orderNotes: 2000,
  text: 200,
  qtyMin: 1,
  qtyMax: 99999,
  // Link config limits (the config is untrusted: anyone can edit a URL).
  configMaterials: 500,
  configLocations: 20,
  configLabel: 120,
  configId: 64,
  configMessage: 500,
};

// File extension → file kind. Anything else is rejected.
export const EXTENSIONS = { '.dxf': 'dxf', '.step': 'step', '.stp': 'step' };
export const ACCEPT = '.dxf,.step,.stp';

// Material types (ORDER_FORM_SCOPE.md §6.1) and the dropdown group each belongs to.
export const MATERIAL_TYPES = {
  sheet: 'Sheet and Plate',
  sqtube: 'Square Tube',
  rectube: 'Rectangular Tube',
  rndtube: 'Round Tube',
  pipe: 'Pipe',
  angle: 'Angle',
};

// The permanent last dropdown option for a material that isn't listed. The customer
// describes it in the line's notes, which are then required (Austin, 2026-10-08).
export const REQUEST_ID = '__request__';
export const REQUEST_LABEL = 'Request in notes';

// Which file kind a material type takes: sheet → DXF, everything else → STEP.
// A "Request in notes" line takes either.
export function fileKindFor(type) {
  if (type === REQUEST_ID) return null;
  return type === 'sheet' ? 'dxf' : 'step';
}
