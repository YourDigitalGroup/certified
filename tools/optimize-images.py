#!/usr/bin/env python3
"""Shrink the slide images the training portal references.

Reads every assets/… and uploads/… image path quoted in index.html, then for each file:
  * bakes in EXIF orientation and resizes anything wider than MAX_W (the slides are never shown
    larger than ~800 CSS px, so 1600 px covers 2x screens);
  * re-encodes opaque images as progressive JPEG (quality JPEG_Q). Opaque PNGs become real JPEGs and
    are renamed .png → .jpg, with every reference in index.html rewritten to match;
  * keeps images with transparency as PNG, palette-packed when that is lossless;
  * only replaces a file when the result is at least 5% smaller.

Usage:  python3 tools/optimize-images.py [--dry-run]
Needs Pillow (pip install pillow). Safe to re-run; already-small files are left alone.
"""
import io
import os
import re
import sys
from urllib.parse import unquote

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, 'index.html')
MAX_W = 1600
JPEG_Q = 82
WEBP_Q = 85
MIN_BYTES = 30 * 1024
DRY = '--dry-run' in sys.argv

html = open(INDEX, encoding='utf-8').read()
refs = sorted(set(m.group(1) for m in re.finditer(r'["\']((?:assets|uploads)/[^"\']+?\.(?:jpe?g|png))["\']', html, re.I)))


def encode(im, fmt, **kw):
    buf = io.BytesIO()
    im.save(buf, fmt, **kw)
    return buf.getvalue()


def shrink(path):
    """Return (bytes, extension) for the best smaller encoding, or None to leave the file alone."""
    im = Image.open(path)
    im.load()
    im = ImageOps.exif_transpose(im)
    if im.mode == 'P' or (im.mode in ('L', 'RGB') and 'transparency' in im.info):
        im = im.convert('RGBA')
    has_alpha = im.mode in ('RGBA', 'LA') and im.getchannel('A').getextrema()[0] < 255
    if im.width > MAX_W:
        im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
    if has_alpha:
        rgba = im.convert('RGBA')
        best = encode(rgba, 'PNG', optimize=True), '.png'
        if rgba.getcolors(256) is not None:  # 256 colours or fewer: palette form is lossless
            pal = encode(rgba.quantize(colors=256, method=Image.Quantize.FASTOCTREE), 'PNG', optimize=True), '.png'
            if len(pal[0]) < len(best[0]):
                best = pal
        # Photographic images with transparency (screenshots on a cut-out device, say) stay huge as
        # PNG; WebP keeps the alpha channel at a fraction of the size. Only switch when it clearly wins.
        webp = encode(rgba, 'WEBP', quality=WEBP_Q, method=6)
        if len(webp) < len(best[0]) * 0.6:
            best = webp, '.webp'
        return best
    rgb = im.convert('RGB')
    return encode(rgb, 'JPEG', quality=JPEG_Q, optimize=True, progressive=True), '.jpg'


before_total = after_total = 0
renames = {}
changed = skipped = missing = 0
for ref in refs:
    path = os.path.join(ROOT, unquote(ref))
    if not os.path.isfile(path):
        missing += 1
        print(f'   missing  {ref}')
        continue
    size = os.path.getsize(path)
    before_total += size
    if size < MIN_BYTES:
        after_total += size
        skipped += 1
        continue
    try:
        data, ext = shrink(path)
    except Exception as e:  # unreadable or exotic file: leave it
        print(f'   skip     {ref}: {e}')
        after_total += size
        skipped += 1
        continue
    if len(data) > size * 0.95:
        after_total += size
        skipped += 1
        continue
    root_no_ext, old_ext = os.path.splitext(path)
    same = (old_ext.lower() in ('.jpg', '.jpeg') and ext == '.jpg') or old_ext.lower() == ext
    new_path = path if same else root_no_ext + ext
    new_ref = ref if new_path == path else ref[: -len(old_ext)] + ext
    after_total += len(data)
    changed += 1
    print(f'{size / 1024:8.0f} KB → {len(data) / 1024:6.0f} KB  {ref}' + (f'  →  {new_ref}' if new_ref != ref else ''))
    if DRY:
        continue
    with open(new_path, 'wb') as f:
        f.write(data)
    if new_path != path:
        os.remove(path)
        renames[ref] = new_ref

if renames and not DRY:
    for old, new in renames.items():
        html = html.replace('"' + old + '"', '"' + new + '"').replace("'" + old + "'", "'" + new + "'")
    open(INDEX, 'w', encoding='utf-8').write(html)
    # Anything else in the repo that still points at an old name gets flagged rather than edited.
    for dirpath, _dirs, files in os.walk(ROOT):
        if any(part.startswith('.') or part in ('node_modules', 'uploads', 'assets', 'data', 'vendor') for part in dirpath[len(ROOT):].split(os.sep)):
            continue
        for fn in files:
            if not fn.endswith(('.html', '.js', '.json', '.md', '.css')) or fn == 'index.html':
                continue
            fp = os.path.join(dirpath, fn)
            try:
                txt = open(fp, encoding='utf-8').read()
            except Exception:
                continue
            for old in renames:
                if old in txt:
                    print(f'   NOTE: {fp[len(ROOT) + 1:]} still references {old}')

print(f'\n{len(refs)} referenced images: {changed} rewritten, {skipped} left as they were, {missing} missing.')
print(f'Total {before_total / 1048576:.1f} MB → {after_total / 1048576:.1f} MB' + (' (dry run, nothing written)' if DRY else '') + (f'; {len(renames)} renamed (' + ', '.join(sorted(set(os.path.splitext(o)[1] + ' → ' + os.path.splitext(n)[1] for o, n in renames.items()))) + ') and index.html updated' if renames and not DRY else ''))
