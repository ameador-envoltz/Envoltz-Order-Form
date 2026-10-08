# fab-order-form

Customer order / request-for-quote form for Envoltz. A static web page (no build step, no backend): customers open a link made by **fab-quoter V2** (Settings → Order Form → Copy Link), fill in their details, attach DXF/STEP files, pick a material and quantity per part, and send back one `.zip` order file. The quoter's Load Order reads that file.

Spec: `ORDER_FORM_SCOPE.md` in fab-quoter V2, plus the decisions logged in fab-quoter V2's `CLAUDE.md` (2026-10-08 entries). Publishing: see `DEPLOY.md`.

## Layout

| Path | What it does |
|---|---|
| `index.html`, `styles.css` | The page. Strict Content-Security-Policy: own scripts/styles only, no inline code. |
| `src/limits.js` | Every limit and fixed value (form version, file size caps, part limits, material types). |
| `src/config.js` | Decodes and validates the link (`#c=…`, deflate-raw + base64url). Treats it as untrusted. `#demo` loads a sample. |
| `src/model.js` | Order/line shapes; address source (a link location or typed). |
| `src/validate.js` | Every problem at once (blocking) plus warnings. |
| `src/files.js` | Extension/size checks, duplicate files. No parsing: the quoter parses. |
| `src/pack.js` | Builds `order.json` + `summary.txt` + `files/…` into the zip. |
| `src/draft.js` | Autosave: fields in localStorage, files in IndexedDB; guarded for private browsing. |
| `src/share.js` | Phone share sheet, else download + email instructions. |
| `src/ui-*.js`, `src/dom.js`, `src/main.js` | The screen. Text is only ever set with `textContent`. |
| `vendor/fflate.js` | fflate 0.8.3 (MIT, `vendor/fflate.LICENSE`): zip/deflate in the browser. |
| `test/` | `npm test` (Node's built-in test runner). |
| `fixtures/` | Sample link config and a sample order zip shared with the quoter's tests (`npm run fixture`). |

## Local testing

Serve the folder with any static server and open `http://localhost:<port>/#demo`, or paste the part of a quoter link after `#` onto the local address. `localhost` counts as a secure page, like `https://`.
