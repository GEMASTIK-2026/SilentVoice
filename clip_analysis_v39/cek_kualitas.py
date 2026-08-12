# -*- coding: utf-8 -*-
"""Cek kualitas crop bibir dari data debug_clip hasil rekaman baru.

Cara pakai:
  python cek_kualitas.py  (dari dalam folder clip_analysis_v36, data sudah di sini)

Membaca per clip: raw/meta.txt (w= h= orient=), raw/landmarks.bin (42 titik:
40 bibir + lEye + rEye, big-endian float), lalu mencetak metrik:
  - margin kiri/kanan bibir relatif frame
  - sudut mata (harus konsisten & kecil bila sudah rata)
  - konsistensi dimensi antar clip (orientasi sama)
"""
import os, re, struct, sys
import numpy as np

BASE = os.path.dirname(os.path.abspath(__file__))

def baca_raw(clip_dir):
    meta_p = os.path.join(clip_dir, "raw", "meta.txt")
    lm_p   = os.path.join(clip_dir, "raw", "landmarks.bin")
    if not (os.path.exists(meta_p) and os.path.exists(lm_p)):
        return None
    meta = open(meta_p, encoding="utf-8", errors="replace").read()
    m = re.search(r"w=(\d+) h=(\d+) orient=(\d+)", meta)
    if not m:
        return None
    W, H, orient = int(m.group(1)), int(m.group(2)), int(m.group(3))
    raw = open(lm_p, "rb").read()
    n = len(raw) // 4
    vals = struct.unpack(">%df" % n, raw)  # big-endian, sama dgn ByteBuffer JVM
    pts = np.array(vals).reshape(-1, 2)
    return W, H, orient, pts

def main():
    clips = sorted(d for d in os.listdir(BASE)
                   if os.path.isdir(os.path.join(BASE, d)) and d.startswith("clip_"))
    if not clips:
        print("Tidak ada folder clip_* di", BASE)
        return 1
    print("%-8s %-18s %-22s %-16s %s" % (
        "clip", "dimensi", "bbox bibir", "sudut mata", "margin L/R"))
    dims_set = set()
    ok = True
    for c in clips:
        r = baca_raw(os.path.join(BASE, c))
        if r is None:
            print("%-8s (raw tidak ada)" % c)
            continue
        W, H, orient, pts = r
        lips, le, re = pts[:40], pts[40], pts[41]
        x0, x1 = lips[:, 0].min(), lips[:, 0].max()
        y0, y1 = lips[:, 1].min(), lips[:, 1].max()
        ang = np.degrees(np.arctan2(re[1] - le[1], re[0] - le[0]))
        ml, mr = x0 / W * 100, (W - x1) / W * 100
        dims_set.add((W, H))
        flag = ""
        if ml < 5 or mr < 5:
            flag += "  <-- BIBIR DEKAT TEPI"
            ok = False
        if abs(ang) > 10:
            flag += "  <-- MIRING"
            ok = False
        print("%-8s %-18s %-22s %-16s %5.0f%% / %5.0f%%%s" % (
            c, "%dx%d o=%d" % (W, H, orient),
            "x[%d..%d] y[%d..%d]" % (x0, x1, y0, y1),
            "%.1f deg" % ang, ml, mr, flag))
    if len(dims_set) > 1:
        print("\n!! DIMENSI BERVARIASI antar clip:", sorted(dims_set),
              "-> orientasi tidak konsisten (masalah orientasi kamera).")
        ok = False
    else:
        print("\nDimensi konsisten:", dims_set)
    print("\nHASIL:", "OK - crop tampak sehat" if ok else "ADA MASALAH - cek flag di atas")
    return 0 if ok else 2

if __name__ == "__main__":
    sys.exit(main())
