// Getting the order file to the customer (Austin, 2026-10-09): one "Download completed order
// form" button. The customer then attaches the file to their email to us (a reply to our
// email, or a new one; the panel offers our address to copy). A web page can't attach files
// to email or put a file on the clipboard, so the download is the one step that works the
// same on every device and browser.

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
