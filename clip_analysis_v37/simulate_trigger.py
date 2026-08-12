# -*- coding: utf-8 -*-
"""Simulasi ulang state machine LipCaptureEngine dari meta.csv nyata (clip_*).

Menjawab: kapan RECORDING ter-trigger, threshold dinamis baseline, dan apakah
spike MAR yang bukan-buka-mulut mampu memicu. Pakai konstanta persis Kotlin:
  RING_BUFFER_SIZE=20, MAR_K_STD_OPEN=1.5, MAR_K_STD_CLOSE=0.5,
  OPEN_TRIGGER_FRAMES=5, CLOSE_STABLE_FRAMES=20.
Output: tabel trigger per clip + frame-frame spike besar (MAR >> lantai ambien).
"""
import os, sys
import numpy as np

BASE = os.path.dirname(os.path.abspath(__file__))
RING = 20
K_OPEN = 1.5
K_CLOSE = 0.5
OPEN_FRAMES = 5
CLOSE_STABLE = 20

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
                rows.append((int(parts[0]), float(parts[1]), parts[3] == "1"))
    return rows

def simulate(rows):
    """Kembalikan list event trigger + frame-frame spike besar vs lantai."""
    ring = []
    events = []
    hits = []
    floor = 0.0
    for fidx, mar, detected in rows:
        if ring:
            floor = float(np.mean(ring[-RING:]))
        hits.append((fidx, mar, floor))
        if len(ring) < RING:
            ring.append(mar)
            continue
        th_open = float(np.mean(ring[-RING:])) + K_OPEN * float(np.std(ring[-RING:]))
        if mar > th_open:
            events.append((fidx, mar, th_open))
        ring.append(mar)
        ring = ring[-RING:]
    return events, hits

def main():
    clips = sorted(d for d in os.listdir(BASE)
                   if os.path.isdir(os.path.join(BASE, d)) and d.startswith("clip_"))
    if not clips:
        print("tidak ada clip_* di", BASE); return 1
    for c in clips:
        d = os.path.join(BASE, c)
        rows = read_meta(d)
        if not rows:
            print(f"{c:8s} (meta.csv tidak ada)"); continue
        mar_arr = np.array([r[1] for r in rows])
        floor = float(np.median(mar_arr[:RING])) if len(rows) > RING else float(np.median(mar_arr))
        # lantai murni tertutup = median segmen awal (pre-roll), spike > 5*fraktil50
        spikes = [(r[0], r[1]) for r in rows if r[1] > max(0.04, floor * 3)]
        events, _ = simulate(rows)
        ev_str = ", ".join(f"f{r[0]}({r[1]:.3f})" for r in events[:6])
        print(f"{c:8s} n={len(rows):3d} lantai={floor:.4f} spikes={len(spikes)} "
              f"[{', '.join(f'f{i}({m:.3f})' for i, m in spikes[:5])}]")
        print(f"           trigger-calon (>th): {ev_str or 'tidak ada'}")
    return 0

if __name__ == "__main__":
    sys.exit(main())