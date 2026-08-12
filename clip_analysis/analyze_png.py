# -*- coding: utf-8 -*-
"""
Analisis piksel PNG DebugClipSaver: apakah berisi citra bibir (abu-abu) asli
atau hanya latar hitam + titik landmark merah.
"""
import os
from PIL import Image

BASE = r"D:\claudeCode\SilentVoice\clip_analysis"

FRAMES = [
    "clip_7\\frame_0016.png",   # mulut membuka lebar (MAR 0.50)
    "clip_7\\frame_0042.png",   # tengah ucapan (MAR 0.46)
    "clip_7\\frame_0001.png",   # pre-roll diam (MAR ~0.004)
    "clip_2\\frame_0016.png",   # clip_2 membuka (MAR 0.51)
    "clip_5\\frame_0030.png",   # mulut terbuka tahan (MAR 0.54)
    "clip_5\\resample_15.png",  # tengah 30-frame ONNX
    "clip_4\\frame_0018.png",   # mulut membuka cepat (MAR 0.40)
]


def analyze(path):
    im = Image.open(path).convert("RGB")
    W, H = im.size
    px = im.load()

    total = W * H
    red = 0          # piksel titik landmark (R jauh > G/B)
    gray_pix = 0     # piksel abu-asli (R==G==B dan bukan hitam pekat)
    gray_sum = 0
    blackish = 0     # r+g+b < 24 (hampir hitam)
    bw = 0
    for y in range(H):
        row_red = 0
        for x in range(W):
            r, g, b = px[x, y]
            if r > 170 and g < 120 and b < 120:
                row_red += 1
            elif abs(r - g) < 8 and abs(g - b) < 8:
                if r > 20:
                    g_pix = 1
                    gray_pix += 1
                    gray_sum += r
                else:
                    min_pix = 1
                    bw += 1
        red += row_red

    mean = gray_sum / max(1, gray_pix)
    return {
        "name": os.path.basename(path),
        "size": f"{W}x{H}",
        "red_pct": 100 * red / total,
        "gray_pix_pct": 100 * gray_pix / total,
        "gray_mean": round(mean, 1),
        "black_pct": 100 * bw / total,
    }


def ascii_map(path, cols=36, rows=22):
    """Downsample luminance jadi peta ASCII supaya 'terlihat' di terminal."""
    im = Image.open(path).convert("L").resize((cols, rows))
    px = im.load()
    ramp = " .:-=+*#%@"
    out = []
    for y in range(rows):
        line = ""
        for x in range(cols):
            v = px[x, y]
            line += ramp[min(9, v * 10 // 256)]
        out.append(line)
    return "\n".join(out)


for f in FRAMES:
    p = os.path.join(BASE, f)
    if not os.path.exists(p):
        print(f"TIDAK ADA: {f}")
        continue
    st = analyze(p)
    print("=" * 60)
    print(f"{f}  {st['name']}")
    print(f"  titik merah: {st['red_pct']}% | abu-abu asli: {st['gray_pix_pct']}% "
          f"(mean {st['gray_mean']}) | hitam: {st['black_pct']}%")
    print(ascii_map(p))