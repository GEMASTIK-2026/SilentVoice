# -*- coding: utf-8 -*-
"""Verifikasi logika trigger baru (MAR smoothing 5-frame) pada data klip NYATA.

Menjawab: apakah dengan moving-average window 5 + OPEN_TRIGGER_FRAMES=5,
buka-mulut sungguhan (clip_1..3) masih ter-trigger? Dan apakah spike palsu
(clip_5, f9 & f32-34) sudah tidak ter-trigger?

Merekonstruksi persis LipCaptureEngine.onFrame:
  - marRing: 20 MAR raw terakhir -> threshold = mean + 1.5*std
  - smoothMar: window 5 rata-rata dari raw MAR yang masuk BERURUTAN
  - openStreak >= 5 => RECORDING trigger
"""
import os, sys
import numpy as np

BASE = os.path.dirname(os.path.abspath(__file__))
RING = 20
K_OPEN = 1.5
SMOOTH_WIN = 5
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

def simulate_trigger(rows):
    mar_ring = []
    mar_smooth = []
    open_streak = 0
    trigger_frames = []
    for fidx, mar in rows:
        mar_ring.append(mar)
        if len(mar_ring) > RING:
            mar_ring = mar_ring[-RING:]
        if len(mar_ring) >= RING:
            mar_smooth.append(mar)
            if len(mar_smooth) > SMOOTH_WIN:
                mar_smooth = mar_smooth[-SMOOTH_WIN:]
            smooth = float(np.mean(mar_smooth))
            mean = float(np.mean(mar_ring))
            std = float(np.std(mar_ring))
            thresh = mean + K_OPEN * std
            if smooth > thresh:
                open_streak += 1
                if open_streak >= OPEN_FRAMES:
                    trigger_frames.append(fidx)
                    open_streak = 0
            else:
                open_streak = 0
    return trigger_frames

def main():
    clips = sorted(d for d in os.listdir(BASE)
                   if os.path.isdir(os.path.join(BASE, d)) and d.startswith("clip_"))
    for c in clips:
        rows = read_meta(os.path.join(BASE, c))
        if not rows:
            print(c, "no meta"); continue
        tf = simulate_trigger(rows)
        status = "TRIGGER OK" if tf else "TIDAK TRIGGER <-- MASALAH"
        print(f"{c:8s} buka-mulut asli(f15-23)={any(15<=f<=23 for f in tf)} "
              f"trigger@f={tf[:8]} -> {status}")
    return 0

if __name__ == "__main__":
    sys.exit(main())