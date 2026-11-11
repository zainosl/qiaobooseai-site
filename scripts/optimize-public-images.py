#!/usr/bin/env python3
"""Build content-addressed web images without changing source artwork.

Run after importing new articles: python3 scripts/optimize-public-images.py
Requires Pillow. Diagrams and QR codes use full-resolution lossless WebP.
"""
import hashlib
import io
import json
import re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'media/optimized'
MANIFEST = ROOT / 'scripts/public-image-manifest.json'
OUT.mkdir(parents=True, exist_ok=True)
records = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}


def optimize_tag(match, base):
    tag = match.group()
    source = re.search(r'\bsrc="([^"]+)"', tag)
    if not source or source[1].startswith(('http:', 'https:', 'data:')):
        return tag
    path = (base / source[1]).resolve()
    if not path.is_relative_to(ROOT) or not path.is_file():
        return tag
    with Image.open(path) as img:
        width, height = img.size
        if not path.is_relative_to(OUT) and getattr(img, 'n_frames', 1) == 1:
            buffer = io.BytesIO()
            # The shared portrait is a photo; preserve dimensions and transparency.
            photo = path.name == '6dc76c4ae6c92c559627.png'
            img.save(buffer, 'WEBP', lossless=not photo, quality=85 if photo else 100, method=6)
            data = buffer.getvalue()
            if len(data) < path.stat().st_size:
                digest = hashlib.sha256(data).hexdigest()[:16]
                dest = OUT / (digest + '.webp')
                dest.write_bytes(data)
                prefix = '../' if base == ROOT / 'resources' else ''
                tag = tag[:source.start(1)] + prefix + dest.relative_to(ROOT).as_posix() + tag[source.end(1):]
                records[path.relative_to(ROOT).as_posix()] = {
                    'optimized': dest.relative_to(ROOT).as_posix(),
                    'original_bytes': path.stat().st_size, 'optimized_bytes': len(data),
                    'width': width, 'height': height, 'lossless': not photo,
                }
    for key, value in [('width', width), ('height', height), ('loading', 'lazy'), ('decoding', 'async')]:
        if not re.search(r'\b' + key + r'\s*=', tag):
            tag = re.sub(r'\s*/?>$', lambda m: f' {key}="{value}"' + m[0], tag)
    return tag


def optimize_html(html, base):
    return re.sub(r'<img\b[^>]*>', lambda m: optimize_tag(m, base), html)


resource = ROOT / 'resources/index.html'
old = resource.read_text()
new = optimize_html(old, resource.parent)
if new != old:
    resource.write_text(new)

for path in (ROOT / 'articles/content').glob('*.js'):
    old = path.read_text()
    # Only replace HTML string values; leave prose, IDs and JS wrappers untouched.
    def replace_html(match):
        html = json.loads(match[2])
        result = optimize_html(html, ROOT)
        return match[1] + json.dumps(result, ensure_ascii=False)
    new = re.sub(r'("html"\s*:\s*)("(?:\\.|[^"\\])*")', replace_html, old)
    if new != old:
        path.write_text(new)

MANIFEST.write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'images': len(records),
    'original_bytes': sum(x['original_bytes'] for x in records.values()),
    'optimized_bytes': sum(x['optimized_bytes'] for x in records.values())}, indent=2))
