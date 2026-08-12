# -*- coding: utf-8 -*-
"""Simulasi SETIA ring-20 + banding banyak varian (final).
Target biar jelas (dari metrik nyata):
  clip_1 apex0.63, clip_2 apex0.49, clip_3 apex0.49  -> WAJIB trigger (buka asli)
  clip_4 apex0.012, clip_5 apex0.082/f32-34 spike    -> JANGAN trigger (false/diam)

Varian:
  A raw/raw           (build <v38 yang sukses rekam 1-3)
  B mean3/raw-ring
  C mean5/raw-ring    (v38 sekarang - tumpul)
  D mean3 both
  E median3/raw-ring
  F median5/raw-ring
  G median3 both
"""
import os, sys
import numpy as np

BASE = os.path.dirname(os.path.abspath(__file__))
RING = 20
K_OPEN = 1.5
OPEN_FRAMES = 5

def read_meta(d):
    p = os.path.join(d, "meta.csv")
    if not os.path.exists(p):
        return None
    rows = []
    with open(p) as f:
        f.readline()
        for line in f:
            parts = line.strip().split(",")
            if len(parts) >= 4:
                rows.append((int(parts[0]), float(parts[1])))
    return rows

def window_up(buf, val, n, mode):
    buf.append(val)
    if len(buf) > n:
        buf.pop(0)
    if mode == "mean":
        return float(np.mean(buf))
    return float(np.median(buf))

def trig(rows, sig_mode, ring_mode, sig_n, ring_n):
    ring = []
    sig = []
    rbuf = []
    streak = 0
    out = []
    for fidx, mar in rows:
        if ring_mode == "raw":
            ring.append(mar)
            if len(ring) > RING: ring.pop(0)
        else:
            rv = window_up(rbuf, mar, ring_n, ring_mode)
            ring.append(rv)
            if len(ring) > RING: ring.pop(0)
        if len(ring) < RING:
            continue
        if sig_mode == "raw":
            val = mar
        else:
            val = window_up(sig, mar, sig_n, sig_mode)
        mean = float(np.mean(ring)); std = float(np.std(ring))
        th = mean + K_OPEN * std
        if val > th:
            streak += 1
            if streak >= OPEN_FRAMES:
                out.append(fidx); streak = 0
        else:
            streak = 0
    return out

APE = {"clip_1":"0.63","clip_2":"0.49","clip_3":"0.49","clip_4":"0.012(diam)","clip_5":"0.082(false)"}
WANT = {"clip_1":"YES","clip_2":"YES","clip_3":"YES","clip_4":"no","clip_5":"no"}

def main():
    clips = sorted(d for d in os.listdir(BASE)
                   if os.path.isdir(os.path.join(BASE, d)) and d.startswith("clip_"))
    variants = [
        ("A raw/raw      ", "raw", "raw", 0, 0),
        ("B mean3/raw    ", "mean", "raw", 3, 0),
        ("C mean5/raw    ", "mean", "raw", 5, 0),
        ("D mean3 both   ", "mean", "mean", 3, 3),
        ("E median3/raw  ", "median", "raw", 3, 0),
        ("F median5/raw  ", "median", "raw", 5, 0),
        ("G mean2/raw    ", "mean", "raw", 2, 0),
    ]
    header = "MODE".ljust(16) + " " + " ".join(f"{c:>10s}" for c in clips)
    print(header)
    print("(apex)         " + " ".join(f"{APE[c]:>10s}" for c in clips))
    print("(target)       " + " ".join(f"{WANT[c]:>10s}" for c in clips))
    print("-" * len(header))
    for label, sm, rm, sn, rn in variants:
        cells = [label]
        for c in clips:
            rows = read_meta(os.path.join(BASE, c))
            if not rows:
                cells.append("nodata"); continue
            tf = trig(rows, sm, rm, sn, rn)
            cells.append(("YES@%s" % tf[0]) if tf else "no")
        print(" ".join(f"{x:>10s}" for x in cells))
    return 0

if __name__ == "__main__":
    sys.exit(main())