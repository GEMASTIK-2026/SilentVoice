# -*- coding: utf-8 -*-
"""Simulasi SETIA (ring 20 ter-update penuh) + perbandingan varian trigger.
Target: clip_1,2,3 (buka jelas, apex 0.4-0.6) TETAP trigger; clip_4 (noise,
apex 0.012) dan clip_5 (apex 0.08, false per user) TIDAK trigger.

Varian:
  A  raw ring / raw val          [state lama build <v38 — bukti baseline]
  B  raw ring / mean3 val
  C  raw ring / mean5 val        [v38 sekarang — tidak merekam = regresi]
  D  mean3 ring / mean3 val      [konsisten smooth]
  E  mean5 ring / mean5 val
  F  raw ring / median3 val
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
    sr = []
    sv = []
    streak = 0
    out = []
    for fidx, mar in rows:
        if mode.startswith("mean"):
            sr.append(mar)
            if len(sr) > int(mode[-1]): sr = sr[-int(mode[-1]):]
            ringval = float(np.mean(sr))
        else:
            ringval = mar
        ring.append(ringval)
        if len(ring) > RING: ring = ring[-RING:]
        if len(ring) < RING: continue
        # nilai sinyal utk keputusan
        val = mar
        if mode.startswith("mean"):
            sv.append(mar)
            if len(sv) > int(mode[-1]): sv = sv[-int(mode[-1]):]
            val = float(np.mean(sv))
        elif mode.startswith("median"):
            sv.append(mar)
            if len(sv) > int(mode[6]): sv = sv[-int(mode[6]):]
            val = float(np.median(sv))
        mean = float(np.mean(ring)); std = float(np.std(ring))
        th = mean + K_OPEN * std
        if val > th:
            streak += 1
            if streak >= OPEN_FRAMES:
                out.append(fidx); streak = 0
        else:
            streak = 0
    return out

apex = {"clip_1":0.63,"clip_2":0.49,"clip_3":0.49,"clip_4":0.012,"clip_5":0.082}

def desc(tf):
    return "trigger@%s" % (tf[:4]) if tf else "----"

def main():
    modes = ["A:raw","B:mean3","C:mean5","D:mean3ring+mean3","E:mean5ring+mean5","F:median3"]
    clips = sorted(d for d in os.listdir(BASE)
                   if os.path.isdir(os.path.join(BASE, d)) and d.startswith("clip_"))
    # mapping mode -> (mode param)
    mode_map = {"A:raw":"raw","B:mean3":"mean3","C:mean5":"mean5",
                "D:mean3ring+mean3":"mean3+d","E:mean5ring+mean5":"mean5+d","F:median3":"median3"}
    print(f"{'mode':<18s} " + " ".join(f"{c:>8s}" for c in clips))
    for label in modes:
        param = mode_map[label]
        # proses param d: ring dismooth + val dismooth
        if param.endswith("+d"):
            m = param[:-2]
            def run_p(rows):
                # smooth SAMA utk ring & val
                ring=[]; sr=[]; streak=0; out=[]
                for fidx, mar in rows:
                    sr.append(mar)
                    if len(sr)>int(m): sr=sr[-int(m):]
                    rv=float(np.mean(sr))
                    ring.append(rv)
                    if len(ring)>RING: ring=ring[-RING:]
                    if len(ring)<RING: continue
                    val=rv
                    mean=float(np.mean(ring)); std=float(np.std(ring))
                    th=mean+K_OPEN*std
                    if val>th:
                        streak+=1
                        if streak>=OPEN_FRAMES: out.append(fidx); streak=0
                    else: streak=0
                return out
        else:
            run_p = lambda rows: trig(rows, param)
        row = [f"{label:<18s}"]
        for c in clips:
            rows = read_meta(os.path.join(BASE, c))
            if not rows: row.append("------"); continue
            tf = run_p(rows)
            ok = "OK" if tf else "--"
            row.append(f"{ok}@{tf[0] if tf else '-'}")
        print(" ".join(f"{x:>8s}" for x in row))
    print("\napx MAR: ", apex)
    return 0

if __name__ == "__main__":
    sys.exit(main())