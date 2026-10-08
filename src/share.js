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
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'downloaded';
}

// mailto: can't attach files; the panel that shows this link says so plainly.
export function mailtoLink(returnEmail, subject, body) {
  return `mailto:${encodeURIComponent(returnEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
