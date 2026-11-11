#!/usr/bin/env python3
"""Render 1200x630 share cards into static/og/<slug>.png from tools/og-cards.json
(written by build.mjs). Run: node build.mjs && python3 tools/og_cards.py && node build.mjs"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(root)
W, H = 1200, 630
I = '/usr/share/fonts/opentype/inter/'
def F(n, s): return ImageFont.truetype(I + n, s)
B, R = 'Inter-Bold.otf', 'Inter-Regular.otf'
INK, MUTE, PINK, TEAL = (233, 236, 255), (154, 163, 209), (255, 79, 163), (61, 224, 195)
glow = Image.new('RGB', (W, H), (0, 0, 0)); ImageDraw.Draw(glow).ellipse((-200, -300, 700, 400), fill=(70, 28, 62))
glow = glow.filter(ImageFilter.GaussianBlur(120))
BASE = ImageChops.add(Image.new('RGB', (W, H), (13, 15, 31)), glow)

def bottle(slug, box):
    p = f'static/img/f/{slug}/icon.webp'
    if not os.path.exists(p): return None
    im = Image.open(p).convert('RGBA'); im.thumbnail(box, Image.LANCZOS); return im

def fit(d, text, font_name, size, maxw):
    while size > 18:
        f = F(font_name, size)
        if d.textlength(text, font=f) <= maxw: return f
        size -= 2
    return F(font_name, 18)

def placeholder(d, cx, cy):
    d.rounded_rectangle((cx - 70, cy - 90, cx + 70, cy + 110), 28, outline=(43, 50, 96), width=4)
    d.rounded_rectangle((cx - 28, cy - 130, cx + 28, cy - 90), 10, outline=(43, 50, 96), width=4)

def put(bg, d, slug, cx, cy=310):
    im = bottle(slug, (300, 400))
    if im: bg.paste(im, (cx - im.width // 2, cy - im.height // 2), im)
    else: placeholder(d, cx, cy)

def pill(d, price):
    d.rounded_rectangle((470, 455, 730, 520), 32, fill=PINK)
    d.text((600, 488), f'about ${price}', font=F(B, 34), fill=(255, 255, 255), anchor='mm')

def card(sp):
    bg = BASE.copy(); d = ImageDraw.Draw(bg)
    d.rounded_rectangle((40, 40, W - 40, H - 40), 24, fill=(22, 26, 48), outline=(43, 50, 96), width=3)
    if 'solo' in sp:
        s = sp['solo']
        put(bg, d, s['slug'], 280)
        d.text((700, 200), s['brand'].upper(), font=fit(d, s['brand'].upper(), B, 28, 440), fill=TEAL, anchor='lm')
        lines = [s['name']]
        d.text((700, 290), s['name'], font=fit(d, s['name'], B, 56, 440), fill=INK, anchor='lm')
        if sp.get('price'):
            d.rounded_rectangle((700, 360, 960, 425), 32, fill=PINK)
            d.text((830, 393), f"about ${sp['price']}", font=F(B, 34), fill=(255, 255, 255), anchor='mm')
        d.text((600, 575), 'DUPESBASE.COM', font=F(B, 22), fill=PINK, anchor='mm')
        return bg
    o, c = sp['orig'], sp['clone']
    d.text((230, 92), 'THE ORIGINAL', font=F(B, 20), fill=MUTE, anchor='mm')
    d.text((970, 92), 'THE CLONE', font=F(B, 20), fill=TEAL, anchor='mm')
    put(bg, d, o['slug'], 230); put(bg, d, c['slug'], 970)
    on = f"{o['brand']} {o['name']}"; cn = f"{c['brand']} {c['name']}"
    if sp.get('pct') is not None:
        d.text((600, 165), f"{sp['pct']}%", font=F(B, 130), fill=PINK, anchor='mm')
        if not sp.get('rep'): d.text((600, 238), 'notes overlap', font=F(R, 24), fill=MUTE, anchor='mm')
    else:
        d.text((600, 165), 'VS', font=F(B, 100), fill=PINK, anchor='mm')
    d.text((600, 290), on, font=fit(d, on, B, 34, 500), fill=INK, anchor='mm')
    d.text((600, 340), 'vs', font=F(R, 26), fill=MUTE, anchor='mm')
    d.text((600, 392), cn, font=fit(d, cn, B, 44, 500), fill=INK, anchor='mm')
    if sp.get('price'): pill(d, sp['price'])
    d.text((600, 575), 'DUPESBASE.COM', font=F(B, 22), fill=PINK, anchor='mm')
    return bg

specs = json.load(open('tools/og-cards.json'))
os.makedirs('static/og', exist_ok=True)
seen = set()
for sp in specs:
    if sp['slug'] in seen: continue
    seen.add(sp['slug'])
    card(sp).quantize(256, dither=Image.NONE).save(f"static/og/{sp['slug']}.png", optimize=True)
print('cards', len(seen))
