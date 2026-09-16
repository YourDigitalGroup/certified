# Project layout

- `index.html` is the training portal (a single "DC" template + `class Component extends DCLogic`, run by `support.js`). `portal-boot.js` gates it behind sign-in and injects `window.__PORTAL` (user, progress, course overrides, settings).
- `api/*.php` + SQLite in `data/` is the backend; `admin/` is the admin panel; `login.html` handles sign-in and password setup. See `ADMIN.md`.
- After changing modules or videos in `index.html`, run `node tools/build-course-manifest.mjs` and commit `data/course-manifest.json`.

# Project preferences

- Never give image slots / image placeholders a grey background — keep empty image-slot frames transparent (a global `image-slot::part(frame) { background: transparent; }` rule exists in the portal's helmet; keep it).
- User-supplied photos/logos often arrive with a pale grey/blue-grey backdrop baked into the JPEG. Whiten it (canvas pass: near-neutral pixels above ~200 luminance → pure white) before wiring the asset in — the user never wants grey behind their images.
