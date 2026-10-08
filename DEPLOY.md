# Publishing the order form on GitHub Pages

The form is a plain static page: no build step, no server, no secrets. GitHub Pages hosts it for free at an `https://` address, which is required because phone share sheets only work on secure pages.

**What becomes public:** only the form's own files (this folder): the page, its styles, its scripts and the vendored `fflate` library. No prices, materials, customers or orders are in it. Materials and customer details travel inside each link you send (after the `#`, which browsers never send to GitHub), and order files go from the customer's device straight to your email.

## One-time setup (about 10 minutes)

1. **Create the repository.** Signed in at github.com, click **New repository**.
   - Name: `fab-order-form` (the name becomes part of the address).
   - Visibility: **Public** (GitHub Pages on a free account requires it).
   - Leave "Add a README" unchecked. Click **Create repository**.
2. **Upload the files.** On the new repository's page, click **uploading an existing file**, then drag in everything in this folder **except** `node_modules` (there isn't one) and the `test`, `tools` and `fixtures` folders (optional; they're harmless, but customers don't need them). Commit with the message `v1.0.0`.
3. **Turn on Pages.** Repository **Settings → Pages**. Under **Build and deployment**, Source: **Deploy from a branch**; Branch: **main**, folder **/ (root)**. Click **Save**.
4. **Wait for the address.** After a minute or two the Pages screen shows *"Your site is live at `https://<your-username>.github.io/fab-order-form/`"*. Open it: you should see **"This link is incomplete"**. That's correct: the page needs a link from the quoter.
5. **Check it with the demo.** Add `#demo` to the end of the address. A sample form with sample materials should appear.
6. **Connect the quoter.** In fab-quoter V2: **Settings → Order Form → Order form web address**, paste `https://<your-username>.github.io/fab-order-form/`. Check some materials, then **Open Preview** to see the form exactly as a customer will.

## Updating the form later

Only needed when the form itself changes (not when materials, labels or customers change; those ride in the link).

1. Bump the version in `src/limits.js` (`FORM_VERSION`) and `package.json`.
2. In the repository, **Add file → Upload files**, drag in the changed files, commit with the new version as the message (e.g. `v1.0.1`).
3. Tag the release: **Releases → Draft a new release**, tag `v1.0.1`.

Pages republishes automatically within a minute or two. Links you already sent keep working.

## Optional: a company address

GitHub Pages can serve the form at e.g. `orders.envoltz.com` instead (Settings → Pages → Custom domain, plus one DNS record where envoltz.com is managed). Only the web address saved in the quoter changes; nothing in the form does.
