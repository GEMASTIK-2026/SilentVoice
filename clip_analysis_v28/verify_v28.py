# -*- coding: utf-8 -*-
"""
Verifikasi precompute APK #28 (hasil fix BORDER_REFLECT):
1. Meta: profil MAR/segmen per clip
2. Kualitas visual: fraksi piksel abu-abu (isi bibir) per frame segmen —
   pembanding langsung isi gray96 yang benar-benar masuk ONNX
3. Deteksi frame kosong (all-zero gray) — harus menurun drastis vs APK #25
"""
import os
import glob
from PIL import Image

BASE_V28 = r"D:\claudeCode\SilentVoice\clip_analysis_v28"


def read_meta(meta_path):
    """return list of (mar, pre_roll, segment)"""
    rows = []
    with open(meta_path, encoding="utf-8") as f:
        next(f)  # header
        for line in f:
            p = line.strip().split(",")
            if len(p) >= 5:
                rows.append((float(p[1]), int(p[3]), int(p[4])))
    return rows


def gray_stats(png_path):
    """Fraksi piksel abu-abu non-hitam + mean — pembandingan isi visual asli."""
    from PIL import Image
    im = Image.open(png_path).convert("L")
    px = list(im.getdata())
    total = len(px)
    bright = sum(1 for v in px if v > 30)
    return 100.0 * bright / total


def analyze_clip(clip_dir):
    meta = load_meta(os.path.join(clip_dir, "meta.csv"))
    n = len(meta)
    if n == 0:
        return None, None
    pre_count = sum(1 for _, pr, _ in meta if pr == 1)
    seg_count = sum(1 for _, _, s in meta if s == 1)
    peak = max((m for m, _, _ in meta), default=0.0)

    # Ambil sampel frame SEGMEN (yang masuk ONNX) utk cek visual
    seg_idx = [i for i, (_, _, s) in enumerate(meta) if s == 1]
    frames = sorted(glob.glob(os.path.join(clip_dir, "frame_*.png")))
    fill = []
    for i in seg_idx[:6]:
        f = os.path.join(clip_dir, "frame_%04d.png" % i)
        if os.path.exists(f):
            fill.append(round(gray_fill(f)))
    return {
        "total": n, "pre": pre_count, "seg": seg_count, "peakMAR": round(peak, 3),
        "seg_fill_pct": fill,
    }


def gray_fill(png):
    from PIL import Image
    im = Image.open(png).convert("L")
    data = list(im.getdata())
    return 100.0 * sum(1 for v in data if v > 30) / len(data)


print("=== VERIFIKASI PREPROCESSING APK #28 ===")
all_ok = True
for d in sorted(glob.glob(os.path.join(BASE_V28, "clip_*"))):
    name = os.path.basename(d)
    stats, _ = analyze_clip(d)
    if stats is None:
        print(f"{name}: meta.csv KOSONG!")
        continue
    pre, seg = n, s untuk var
    print(f"{name}: total={stats['total']} pre_roll={stats['pre']} segmen={stats['seg']} "
          f"peakMAR={stats['peak']} | gray_fill segmen={stats['gray_fill_pct']}")
    # Frame segmen yang TETAP hitam (< 2% terisi)
    black = [v for v in stats["gray_fill_pct"] if v < 2.0]
    if black:
        all_ok = False
        print(f"   ⚠ {len(black)} frame segmen masih hampir hitam: {black}")

print("\n=== KESIMPULAN ===")
print("Semua segmen berisi visual?" , "YA" if all_ok else "MASIH ADA frame hitam di segmen")