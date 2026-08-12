# -*- coding: utf-8 -*-
"""
Render overlay: frame BGR mentah + landmark MENTAH (koordinat piksel asli).
  - 40 titik bibir  : merah
  - lEye & rEye     : hijau
Output: overlay_raw_<clip>.png di folder analisis.
Menjawab definitif: landmark yang dipakai crop berada di bibir atau di mata?
"""
import os, glob
import numpy as np
import cv2

BASE = r"D:\claudeCode\SilentVoice\clip_analysis_v32"


def read_meta(meta_path):
    info = {}
    with open(meta_path, encoding="utf-8") as f:
        for line in f:
            for tok in line.split():
                if "=" in tok:
                    k, v = tok.split("=", 1)
                    info[k] = v
    return info


def main():
    for d in sorted(glob.glob(os.path.join(BASE, "clip_*"))):
        raw = os.path.join(d, "raw")
        bgr_path = os.path.join(raw, "frame_0000.bgr")
        lm_path = os.path.join(raw, "landmarks.bin")
        meta_path = os.path.join(raw, "meta.txt")
        if not (os.path.exists(bgr_path) and os.path.exists(lm_path) and os.path.exists(meta_path)):
            print(os.path.basename(d), "→ tidak lengkap", file=sys.stderr)
            continue

        info = read_meta(meta_path)
        w = int(info.get("w", 640)); h = int(info.get("h", 480))
        buf = np.fromfile(bgr_path, dtype=np.uint8)
        need = w * h * 3
        if buf.size < need:
            print(f"{os.path.basename(d)}: buf {buf.size} < {need}", file=sys.stderr)
            continue
        img = buf[:need].reshape(h, w, 3)

        lm = np.fromfile(lm_path, dtype=np.float32)
        print(f"{os.path.basename(d)}: landmark count={lm.size // 2}")
        if lm.size < 84:
            print("  → landmark tidak lengkap, skip", file=sys.stderr)
            continue
        pts = lm[:84].reshape(42, 2)
        lips = pts[:40]
        l_eye = pts[40]; r_eye = pts[41]

        # Validasi rentang (jangan sampai koordinat absurd)
        print(f"  lips x:[{lips[:,0].min():.1f}..{lips[:,0].max():.1f}] y:[{lips[:,1].min():.1f}..{lips[:,1].max():.1f}]")
        print(f"  lEye=({l_eye[0]:.1f},{l_eye[1]:.1f}) rEye=({r_eye[0]:.1f},{r_eye[1]:.1f})")

        # Gambar
        overlay = img.copy()
        for (x, y) in lips:
            cv2.circle(overlay, (int(round(x)), int(round(y))), 4, (0, 0, 255), -1)
        for e in (l_eye, r_eye):
            cv2.circle(overlay, (int(round(e[0])), int(round(e[1]))), 5, (0, 255, 0), -1)

        out = os.path.join(BASE, f"overlay_raw_{os.path.basename(d)}.png")
        cv2.imwrite(out, overlay)
        print(f"  → {out}")


if __name__ == "__main__":
    import sys
    main()