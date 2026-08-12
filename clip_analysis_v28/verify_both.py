# -*- coding: utf-8 -*-
"""
Perbandingan verifikasi precompute APK #25 (v25 = clip_analysis) vs APK #28
(v28 = clip_analysis_v28, berisi fix BORDER_REFLECT):
  - Meta: total frame, pre_roll, segment, peak MAR
  - Kualitas visual segmen: fraksi piksel terisi (>30) per frame segmen,
    jumlah frame "hampir hitam" (<2% terisi) — indikator frame kosong.
"""
import os, glob
from PIL import Image

SETS = {
    "APK#25 (sebelum fix)": r"D:\claudeCode\SilentVoice\clip_analysis",
    "APK#28 (fix BORDER_REFLECT)": r"D:\claudeCode\SilentVoice\clip_analysis_v28",
}

def read_meta(meta_path):
    rows = []
    with open(meta_path, encoding="utf-8") as f:
        next(f)
        for line in f:
            p = line.strip().split(",")
            if len(p) >= 5:
                rows.append((float(p[1]), int(p[3]), int(p[4])))
    return rows

def gray_fill(png):
    im = Image.open(png).convert("L")
    data = list(im.getdata())
    return 100.0 * sum(1 for v in data if v > 30) / len(data)

for label, base in SETS.items():
    print("=" * 70)
    print(f"### {label}")
    print(f"{'Clip':8}{'Total':>6}{'PreRoll':>8}{'Segmen':>8}{'PeakMAR':>9}  {'Fill segmen (mean%)':>20}  {'Frame<2%':>9}")
    grand_total_black = 0
    grand_cnt = 0
    for d in sorted(glob.glob(os.path.join(base, "clip_*"))):
        meta = read_meta(os.path.join(d, "meta.csv"))
        if not meta:
            print(os.path.basename(d), "meta kosong"); continue
        n = len(meta)
        pre = sum(1 for _, pr, _ in meta if pr == 1)
        seg = sum(1 for _, _, s in meta if s == 1)
        peak = max((m for m, _, _ in meta), default=0)
        seg_idx = [i for i, (_, _, s) in enumerate(meta) if s == 1]
        fills = [gray_fill(os.path.join(d, "frame_%04d.png" % i)) for i in seg_idx
                 if os.path.exists(os.path.join(d, "frame_%04d.png" % i))]
        black = [f for f in fills if f < 2.0]
        mean_fill = sum(fills)/len(fills) if fills else 0
        print(f"{os.path.basename(d):8}{n:>6}{pre:>8}{seg:>8}{peak:>9.3f}{mean_fill:>18.1f}%{len(black):>6}")
        grand_black += len(black)
        grand_cnt += len(fills)
    print(f">> Frame SEGMEN hampir hitam: {total_black}/{total_cnt} ({100*total_black/max(1,total_cnt):.1f}%)")