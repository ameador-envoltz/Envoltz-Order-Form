// Sending the order file (ORDER_FORM_SCOPE.md §4.7). The form can't email anything itself:
//  - phones / browsers that can share files: the share sheet opens with the zip attached
//  - everything else: the zip downloads and the customer attaches it to an email
// Either way the form never claims the order was sent; it can't know.

export function canShareFile(file) {
  try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [file] })); } catch { return false; }
}

// Returns 'shared' | 'cancelled' | 'downloaded'.
export async function sendOrderFile(blob, fileName, { company, returnEmail }) {
  const file = new File([blob], fileName, { type: 'application/zip' });
  if (canShareFile(file)) {
    try {
      await navigator.share({
        files: [file],
        title: fileName,
        text: returnEmail ? `Order for ${company}. Please send to ${returnEmail}.` : `Order for ${company}.`,
      });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // Some browsers report canShare but then refuse; fall back to downloading.
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}

// --- Ready-to-send email (.eml) -------------------------------------------------------
// A web page can't attach a file to an email (mailto: can't). Instead this builds an
// unsent email file with the order zip already attached: opened in Outlook (classic),
// "X-Unsent: 1" makes it a new message ready to Send. Pure: returns the file's text.

function base64Lines(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/.{1,76}/g, '$&\r\n').trimEnd();
}

// Header values: no line breaks (blocks header injection); non-ASCII → RFC 2047.
function headerValue(s) {
  const clean = String(s || '').replace(/[\r\n]+/g, ' ').trim();
  if (/^[\x20-\x7E]*$/.test(clean)) return clean;
  const utf8 = new TextEncoder().encode(clean);
  let bin = '';
  utf8.forEach(b => { bin += String.fromCharCode(b); });
  return `=?UTF-8?B?${btoa(bin)}?=`;
}

function quotedFileName(name) {
  return String(name).replace(/["\\\r\n]/g, '_');
}

export function buildEml({ to, subject, body, fileName, zipBytes, boundary = 'envoltz-order-' + Math.random().toString(36).slice(2, 12) }) {
  if (!/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(String(to || ''))) throw new Error('No valid return email address in this link.');
  const bodyB64 = base64Lines(new TextEncoder().encode(String(body || '').replace(/\r?\n/g, '\r\n')));
  const name = quotedFileName(fileName);
  return [
    'X-Unsent: 1',
    `To: ${headerValue(to)}`,
    `Subject: ${headerValue(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    bodyB64,
    `--${boundary}`,
    `Content-Type: application/zip; name="${name}"`,
    `Content-Disposition: attachment; filename="${name}"`,
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(zipBytes),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// mailto: can't attach files; the panel that shows this link says so plainly.
export function mailtoLink(returnEmail, subject, body) {
  return `mailto:${encodeURIComponent(returnEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
