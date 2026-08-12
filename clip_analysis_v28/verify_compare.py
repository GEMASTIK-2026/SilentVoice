# -*- coding: utf-8 -*-
"""
Verifikasi precompute: APK #25 (sebelum fix) vs APK #28 (fix BORDER_REFLECT).
- Meta per clip: total, pre_roll, segment, peak MAR
- Kualitas visual segmen: ratarata % piksel terisi (>30) per frame segmen;
  frame "hampir hitam" (fill < 2%) — indikator frame kosong yang masuk ONNX.
Catatan: v28 memakai auto-contrast saat render PNG, sehingga ambang 2%
mungkin sedikit "menutupi" frame yang sebelumnya hitam total; pembandingan
tetap bermakna untuk tren besar.
"""
import os, glob
from PIL import Image

SETS = {
    "APK #25 (sebelum fix)": r"D:\claudeCode\SilentVoice\clip_analysis",
    "APK #28 (fix BORDER_REFLECT)": r"D:\claudeCode\SilentVoice\clip_analysis_v28",
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
    return 100.0 * sum(1 for v in data if v > 30) / len(data) if data else 0.0

def clip_stats(d):
    meta = read_meta(os.path.join(d, "meta.csv"))
    if not meta:
        return None
    n = len(meta)
    pre = sum(1 for _, pr, _ in meta if pr == 1)
    seg = sum(1 for _, _, s in meta if s == 1)
    peak = max((m for m, _, _ in meta), default=0.0)
    seg_idx = [i for i, (_, _, s) in enumerate(meta) if s == 1]
    fills = []
    for i in seg_idx:
        p = os.path.join(d, "frame_%04d.png" % i)
        if os.path.exists(p):
            fills.append(gray_fill(p))
    mean_fill = sum(fills)/len(fills) if fills else 0.0
    black = sum(1 for f in fills if f < 2.0)
    return {"total": n, "pre": pre, "seg": seg, "peak": peak,
            "mean_fill": mean_fill, "n_fill": len(fills), "black": black,
            "n": n, "n_pre": pre, "n_seg": seg}

print("=" * 78)
for label, base in SETS.items():
    print(f"## {label}")
    print(f"{'Clip':8}{'Total':>6}{'Pre':>5}{'Segm':>5}{'PeakMAR':>9}  {'MeanFill%':>9}  {'Frame<2%':>9}")
    tot_black, tot_fill = 0, 0
    for d in sorted(glob.glob(os.path.join(base, "clip_*"))):
        s = clip_stats(d)
        if not s:
            print(os.path.basename(d), "meta kosong"); continue
        print(f"{os.path.basename(d):8}{s['n']:>6}{s['pre']:>5}{s['seg']:>5}{s['peak']:>9.3f}"
              f"{s['mean_fill']:>9.1f}%{s['black']:>9}")
        tot_black += s["black"]; tot_fill += s["n_fill"]
    print(f">> Frame SEGMEN hampir hitam: {tot_black}/{tot_fill} "
          f"({100*tot_black/max(1,tot_fill):.1f}% dari frame segmen yang dianalisis)")
    print()
print("Kesimpulan cepat: bandingkan baris 'Frame SEGMEN hampir hitam' antar kedua APK.")