# -*- coding: utf-8 -*-
"""Bandingkan trigger: (A) raw [base], (B) stdout mean-5, (C) median-3.
Data nyata klip 1-5. Tujuan: buka asli (clip_1..3 min f15-23) TETAP trigger,
spike isolated (clip_5 f9, f32-34, clip_4 noise) TIDAK trigger.
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

def trig(rows, mode):
    ring = []
    buf = []
    streak = 0
    out = []
    for fidx, mar in rows:
        ring.append(mar)
        if len(ring) > RING:
            ring = ring[-RING:]
        if len(ring) < RING:
            continue
        if mode == "raw":
            val = mar
        elif mode == "mean5":
            buf.append(mar)
            if len(buf) > 5: buf = buf[-5:]
            val = float(np.mean(buf))
        elif mode == "median3":
            buf.append(mar)
            if len(buf) > 3: buf = buf[-3:]
            val = float(np.median(buf))
        mean = float(np.mean(ring)); std = float(np.std(ring))
        th = mean + K_OPEN * std
        if val > th:
            streak += 1
            if streak >= OPEN_FRAMES:
                out.append(fidx); streak = 0
        else:
            streak = 0
    return out

def true_open(rows):
    # buka mulut sungguhan: ada 4+ frame beruntun MAR>0.15 (tinggi JELAS)
    runs = []
    cur = []
    for fidx, mar in rows:
        if mar > 0.15:
            cur.append((fidx, mar))
        else:
            if len(cur) >= 4: runs.append(cur)
            cur = []
    if len(cur) >= 4: runs.append(cur)
    return [r[0][0] for r in runs]

def main():
    clips = sorted(d for d in os.listdir(BASE)
                   if os.path.isdir(os.path.join(BASE, d)) and d.startswith("clip_"))
    print(f"{'clip':8s} {'buka_asli@':<12s} {'raw':<14s} {'mean5':<14s} {'median3':<14s}")
    for c in clips:
        rows = read_meta(os.path.join(BASE, c))
        if not rows: continue
        ttrue = true_open(rows)
        def fmt(tr): 
            if not tr: return "TIDAK"
            hit = "V" if any(any(15<=f<=28 for f, _ in [x]) for x in []) else ""
            # hit jika trigger ada di rentang umum
            return "OK" if tr else "TIDAK"
        def label(tf):
            if not tf: return "no-trig"
            # beri nilai apakah trigger masuk rentang buka-asli
            spanned = any(any(abs(f - r) <= 6 for r,(_,mm) in []) for f in tf)
            return "TRIGGER@%s" % tf[:3]
        print(f"{c:8s} {str(ttrue):<12s} {label(trig(rows,'raw')):<14s} "
              f"{label(trig(rows,'mean5')):<14s} {label(trig(rows,'median3')):<14s}")
    return 0

if __name__ == "__main__":
    sys.exit(main())