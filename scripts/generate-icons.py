"""Northstar app icon generator.

Draws the icon with Pillow (no SVG renderer needed) and writes every size the
web app and the Android launcher use. Motif: a four-point north star with a
rising trail of dots below it — small daily habits stepping up to the big goal.

Usage:  python scripts/generate-icons.py            (writes into the repo)
        python scripts/generate-icons.py --preview DIR  (only preview PNGs)
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BG_TOP = (17, 34, 78)      # deep night blue
BG_BOTTOM = (8, 14, 36)
STAR = (255, 214, 102)     # warm gold
STAR_CORE = (255, 247, 220)
TRAIL = (125, 211, 252)    # sky blue


def star_points(cx, cy, r_long, r_short, n=4, rot=-math.pi / 2):
    pts = []
    for i in range(n * 2):
        r = r_long if i % 2 == 0 else r_short
        a = rot + i * math.pi / n
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def draw_motif(size, scale=1.0, offset=(0.0, 0.0)):
    """Transparent layer with star + trail. scale/offset shrink the motif into
    the adaptive-icon safe zone when needed."""
    S = size
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    def P(x, y):  # motif coords are in a 0..1 box
        return ((0.5 + (x - 0.5) * scale + offset[0]) * S, (0.5 + (y - 0.5) * scale + offset[1]) * S)

    def L(v):
        return v * S * scale

    cx, cy = P(0.64, 0.33)

    # Glow behind the star.
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gr = L(0.2)
    gd.ellipse([cx - gr, cy - gr, cx + gr, cy + gr], fill=STAR + (120,))
    glow = glow.filter(ImageFilter.GaussianBlur(L(0.09)))
    layer = Image.alpha_composite(layer, glow)

    d = ImageDraw.Draw(layer)
    d.polygon(star_points(cx, cy, L(0.21), L(0.055)), fill=STAR)
    d.polygon(star_points(cx, cy, L(0.1), L(0.026)), fill=STAR_CORE)

    # Rising trail: dots grow and brighten as they approach the star.
    steps = [(0.2, 0.83, 0.032, 110), (0.29, 0.725, 0.038, 160), (0.375, 0.615, 0.044, 210), (0.455, 0.5, 0.05, 255)]
    for x, y, r, a in steps:
        px, py = P(x, y)
        rr = L(r)
        d.ellipse([px - rr, py - rr, px + rr, py + rr], fill=TRAIL + (a,))
    return layer


def background(size):
    bg = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(bg)
    for y in range(size):
        t = y / (size - 1)
        c = tuple(round(BG_TOP[i] * (1 - t) + BG_BOTTOM[i] * t) for i in range(3))
        d.line([(0, y), (size, y)], fill=c + (255,))
    # A few faint background stars.
    for x, y, r in [(0.18, 0.2, 0.006), (0.3, 0.12, 0.004), (0.85, 0.62, 0.005), (0.78, 0.86, 0.004), (0.12, 0.5, 0.004)]:
        d.ellipse([(x - r) * size, (y - r) * size, (x + r) * size, (y + r) * size], fill=(255, 255, 255, 140))
    return bg


def full_icon(size, round_mask=False):
    S = size * 4  # supersample for smooth edges
    img = Image.alpha_composite(background(S), draw_motif(S))
    if round_mask:
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, S, S], fill=255)
        img.putalpha(mask)
    return img.resize((size, size), Image.LANCZOS)


def foreground(size):
    # Adaptive icons crop to the inner ~66 %: shrink the motif into it.
    S = size * 4
    return draw_motif(S, scale=0.7).resize((size, size), Image.LANCZOS)


def main():
    if len(sys.argv) > 2 and sys.argv[1] == "--preview":
        out = sys.argv[2]
        full_icon(512).save(os.path.join(out, "icon-preview.png"))
        full_icon(96).save(os.path.join(out, "icon-preview-96.png"))
        full_icon(192, round_mask=True).save(os.path.join(out, "icon-preview-round.png"))
        fg = foreground(432)
        bgc = Image.new("RGBA", fg.size, BG_TOP + (255,))
        Image.alpha_composite(bgc, fg).save(os.path.join(out, "icon-preview-adaptive.png"))
        return

    full_icon(1024).convert("RGB").save(os.path.join(ROOT, "public/icons/icon-512.png"))
    res = os.path.join(ROOT, "android/app/src/main/res")
    for dpi, legacy, fg in [("mdpi", 48, 108), ("hdpi", 72, 162), ("xhdpi", 96, 216), ("xxhdpi", 144, 324), ("xxxhdpi", 192, 432)]:
        d = os.path.join(res, f"mipmap-{dpi}")
        full_icon(legacy).save(os.path.join(d, "ic_launcher.png"))
        full_icon(legacy, round_mask=True).save(os.path.join(d, "ic_launcher_round.png"))
        foreground(fg).save(os.path.join(d, "ic_launcher_foreground.png"))
    print("icons written")


if __name__ == "__main__":
    main()
