#!/usr/bin/env python3
"""Builds the invoice email header banners: public/logos/email-<brand>-<lang>.png
Gmail's iPhone dark mode recolours HTML backgrounds but never images, so the
header is a flat image. Re-run if brand colours/logos/wording change:
  pip install Pillow && python3 scripts/build_email_banners.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = ['/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
         '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']
FONT = next(f for f in FONTS if os.path.exists(f))
W, H, S = 1200, 440, 1          # 2x of the 600px email width
NAVY = '#11304C'
BRANDS = {
    'seniors':  {'accent': '#3FA7E0', 'for': {'en': 'for Seniors', 'fr': 'pour aînés'}},
    'business': {'accent': '#C9A227', 'for': {'en': 'for Business', 'fr': 'pour entreprises'}},
}
EMAIL = 'invoices@aiwithrobert.com'

def center(d, y, text, font, fill):
    w = d.textlength(text, font=font)
    d.text(((W - w) / 2, y), text, font=font, fill=fill)

for bid, b in BRANDS.items():
    logo = Image.open(os.path.join(ROOT, 'public/logos', f'{bid}.png')).convert('RGBA').resize((150, 150), Image.LANCZOS)
    for lang, line in b['for'].items():
        img = Image.new('RGB', (W, H), NAVY)
        d = ImageDraw.Draw(img)
        d.rectangle([0, H - 8, W, H], fill=b['accent'])
        tile = Image.new('RGBA', (172, 172), (255, 255, 255, 0))
        td = ImageDraw.Draw(tile)
        td.rounded_rectangle([0, 0, 171, 171], radius=30, fill='#FFFFFF')
        tile.paste(logo, (11, 11), logo)
        img.paste(tile, ((W - 172) // 2, 34), tile)
        center(d, 226, 'AI with Robert', ImageFont.truetype(FONT, 58), '#FFFFFF')
        center(d, 306, line, ImageFont.truetype(FONT, 38), b['accent'])
        center(d, 362, EMAIL, ImageFont.truetype(FONT, 28), '#C8D3DF')
        out = os.path.join(ROOT, 'public/logos', f'email-{bid}-{lang}.png')
        img.save(out, optimize=True)
        print(out, os.path.getsize(out))
