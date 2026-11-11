"""Turn a folder of photos (or a zip) into the site's image layout.
Usage: python3 tools/images.py <folder-or-zip>
Name files after the fragrance, e.g. "Lattafa Khamrah.jpg" (first image = main/icon)
and "Lattafa Khamrah 2.jpg", "Lattafa Khamrah 3.jpg" for extra carousel photos.
Output: static/img/f/<slug>/icon.webp and 1.webp, 2.webp ... (carousel).
"""
import json, os, re, sys, zipfile, tempfile
from PIL import Image
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
F = json.load(open(os.path.join(root, 'data/fragrances.json')))
def slug(s): return re.sub(r'[^a-z0-9]+', '-', s.lower().replace("'", '').replace('’', '')).strip('-')
SLUGS = {slug(f['brand'] + ' ' + f['name']): f for f in F}
STOP = {'the', 'eau', 'de', 'parfum', 'toilette', 'for', 'men', 'women', 'edp', 'edt', 'ml', 'oz'}
def toks(s): return {t for t in re.sub(r'[^a-z0-9]+', ' ', s.lower().replace("'", '')).split() if len(t) > 1 and t not in STOP}
def find(base):
    t = toks(base); best, bs, tie = None, 0, False
    for s, f in SLUGS.items():
        sc = 0
        for cand in [f['brand'] + ' ' + f['name'], f['name']] + f.get('aliases', []):
            ft = toks(cand); hit = len(t & ft)
            sc = max(sc, hit / max(len(t), 1) * .7 + hit / max(len(ft), 1) * .3)
        if sc > bs: best, bs, tie = s, sc, False
        elif sc == bs and sc > 0: tie = True
    return best if bs >= .55 and not tie else None
src = sys.argv[1]
tmp = None
if src.lower().endswith('.zip'):
    tmp = tempfile.mkdtemp(); zipfile.ZipFile(src).extractall(tmp); src = tmp
files = [os.path.join(d, n) for d, _, ns in os.walk(src) for n in ns if n.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')) and not n.startswith('.')]
groups, miss = {}, []
for p in sorted(files):
    name = os.path.splitext(os.path.basename(p))[0]
    m = re.match(r'^(.*?)[\s_-]+(\d{1,2})$', name)
    base, idx = (m.group(1), int(m.group(2))) if m and toks(m.group(1)) else (name, 1)
    s = find(base)
    if not s: miss.append(os.path.basename(p)); continue
    groups.setdefault(s, []).append((idx, p))
for s, items in groups.items():
    items.sort(); d = os.path.join(root, 'static/img/f', s); os.makedirs(d, exist_ok=True)
    for i, (_, p) in enumerate(items):
        im = Image.open(p).convert('RGBA' if p.lower().endswith('png') else 'RGB')
        if i == 0:
            im.thumbnail((960, 720)); im.save(os.path.join(d, 'icon.webp'), 'WEBP', quality=86)
        else:
            im.thumbnail((1000, 1000)); im.save(os.path.join(d, f'{i}.webp'), 'WEBP', quality=84)
    print(f'{s}: icon + {len(items) - 1} extra')
if miss: print('\nNo match for:', *miss, sep='\n  - ')
print(f'\n{len(groups)} fragrances updated. Run: node build.mjs')
