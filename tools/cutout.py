#!/usr/bin/env python3
"""Make a white-background bottle photo transparent and save it as the fragrance icon.
Usage: python3 tools/cutout.py <image> <slug>   -> static/img/f/<slug>/icon.webp
Only floods near-white from the image edges, so clear glass inside the bottle stays see-through.
"""
import sys, os
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage as ndi
src, slug = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB'); a = np.array(im).astype(int)
lab, n = ndi.label(a.min(axis=2) >= 238)
edge = (set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])) - {0}
alpha = np.where(np.isin(lab, list(edge)), 0, 255).astype(np.uint8)
al = Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
out = im.convert('RGBA'); out.putalpha(al)
out = out.crop(out.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox())
pad = int(max(out.size) * 0.03)
c = Image.new('RGBA', (out.width + 2 * pad, out.height + 2 * pad), (0, 0, 0, 0)); c.paste(out, (pad, pad)); c.thumbnail((700, 900))
d = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'static', 'img', 'f', slug); os.makedirs(d, exist_ok=True)
c.save(os.path.join(d, 'icon.webp'), quality=90); print('saved', d, c.size)
