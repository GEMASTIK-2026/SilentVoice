# -*- coding: utf-8 -*-
"""
Render overlay verifikasi (DEVICE BUILD POST-v35 / OOM-fix):
  - frame BGR mentah (raw/frame_0000.bgr) + landmark mentah 42 titik
    (40 bibir merah + lEye/rEye hijau), koordinat piksel asli.
  - Sama persis seperti clip_analysis_v32/overlay_raw.py, TAPI baca landmark
    dengan byte-order BIG-ENDIAN (ByteBuffer JVM default) = konsisten dengan
    cek_kualitas.py yang teruji benar di v36.
Output: overlay_raw_v36_clip_<id>.png
"""
import os, glob, sys
import numpy as np
import cv2

BASE = os.path.dirname(os.path.abspath(__file__))


def read_meta(meta_path):
    info = {}
    with open(meta_path, encoding="utf-8", errors="replace") as f:
        for line in f:
            for tok in line.split():
                if "=" in tok:
                    k, v = tok.split("=", 1)
                    info[k] = v
    return info


def read_landmarks_big_endian(path, count=84):
    raw = open(path, "rb").read()
    vals = np.frombuffer(raw, dtype=">f4")   # big-endian float32
    return vals[:count].reshape(42, 2)


def main():
    made = []
    for d in sorted(glob.glob(os.path.join(BASE, "clip_*"))):
        if not os.path.isdir(d):
            continue
        rid = os.path.basename(d)
        raw = os.path.join(d, "raw")
        bgr_path = os.path.join(raw, "frame_0000.bgr")
        lm_path = os.path.join(raw, "landmarks.bin")
        meta_path = os.path.join(raw, "meta.txt")
        if not (os.path.exists(bgr_path) and os.path.exists(lm_path) and os.path.exists(meta_path)):
            print(rid, "-> tidak lengkap (bgr/lm/meta), skip", file=sys.stderr)
            continue

        info = read_meta(meta_path)
        w = int(info.get("w", 640)); h = int(info.get("h", 480))
        orient = info.get("orient", "?")
        buf = np.fromfile(bgr_path, dtype=np.uint8)
        need = w * h * 3
        if buf.size < need:
            print(rid, f": buf {buf.size} < {need}", file=sys.stderr)
            continue
        img = buf[:need].reshape(h, w, 3)

        pts = read_landmarks_big_endian(lm_path)
        lips, l_eye, r_eye = pts[:40], pts[40], pts[41]

        # validasi rentang koordinat (absurd => endian salah)
        xmin, xmax = lips[:, 0].min(), lips[:, 0].max()
        ymin, ymax = lips[:, 1].min(), lips[:, 1].max()
        if not (0 <= xmin and xmax < w and 0 <= ymin and ymax < h):
            print(rid, f": range bibir di luar frame x[{xmin:.0f}..{xmax:.0f}] y[{ymin:.0f}..{ymax:.0f}] (endian salah?)", file=sys.stderr)
            continue
        print(f"{rid}: orient={orient} w={w} h={h} bbr=({xmin:.0f},{ymin:.0f})-({xmax:.0f},{ymax:.0f}) "
              f"lEye=({l_eye[0]:.0f},{l_eye[1]:.0f}) rEye=({r_eye[0]:.0f},{r_eye[1]:.0f})")

        overlay = img.copy()
        for (x, y) in lips:
            cv2.circle(overlay, (int(round(x)), int(round(y))), 4, (0, 0, 255), -1)
        for e in (l_eye, r_eye):
            cv2.circle(overlay, (int(round(e[0])), int(round(e[1]))), 5, (0, 255, 0), -1)

        out = os.path.join(BASE, f"overlay_raw_v36_{rid}.png")
        cv2.imwrite(out, overlay)
        made.append(out)
        print(f"  -> {out}")

    print(f"\n{len(made)} overlay dibuat.")
    return 0 if made else 1


if __name__ == "__main__":
    sys.exit(main())