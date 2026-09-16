# Project preferences

- Never give image slots / image placeholders a grey background — keep empty image-slot frames transparent (a global `image-slot::part(frame) { background: transparent; }` rule exists in the portal's helmet; keep it).
- User-supplied photos/logos often arrive with a pale grey/blue-grey backdrop baked into the JPEG. Whiten it (canvas pass: near-neutral pixels above ~200 luminance → pure white) before wiring the asset in — the user never wants grey behind their images.
