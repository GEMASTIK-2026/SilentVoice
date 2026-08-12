# -*- coding: utf-8 -*-
"""
Render frame_0000.bgr (BGR mentah) ke PNG untuk inspeksi orientasi buffer.
Dimensi dibaca dari raw/meta.txt (w/h). Output: raw_render_<clip>.png
"""
import os, glob, sys
import numpy as np
import cv2

BASE = r"D:\claudeCode\SilentVoice\clip_analysis_v31"

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
        meta_path = os.path.join(raw, "meta.txt")
        if not (os.path.exists(bgr_path) and os.path.exists(meta_path)):
            print(os.path.basename(d), "→ tidak ada raw", file=sys.stderr)
            continue
        info = read_meta(meta_path)
        w = int(info.get("w", 640)); h = int(info.get("h", 480))
        orient = info.get("orient", "?")

        buf = np.fromfile(bgr_path, dtype=np.uint8)
        need = w * h * 3
        if buf.size < need:
            print(f"{os.path.basename(d)}: buf {buf.size} < {need} — SKIP", file=sys.stderr)
            continue
        img = buf[:need].reshape(h, w, 3)  # BGR

        out = os.path.join(BASE, f"raw_render_{os.path.basename(d)}.png")
        cv2.imwrite(out, img)
        # Info + ukuran file
        print(f"{os.path.basename(d)}: w={w} h={h} orient={orient} buf={buf.size} → {out}")

if __name__ == "__main__":
    main()