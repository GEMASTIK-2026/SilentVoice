# -*- coding: utf-8 -*-
"""
Ground-truth perbandingan matematika crop — Opsi A.

  Implementasi A: crop_align_visual_v2 PERSIS notebook v2 (cv2.warpAffine
                  INTER_LINEAR/BORDER_REFLECT + cv2.resize INTER_AREA)
  Implementasi B: port setia LipProcessing.kt APK #30 (sampling manual
                  bilinear + reflect, window-area untuk downscale,
                  tx/invScale untuk canvas->rotated)

Input sintetis terkontrol: gradien vertikal (atas terang / bawah gelap)
+ bibir merah + mata hijau, dimiringkan. Kalau arah rotasi/skala salah,
"terbalik"/"jidat" langsung kelihatan, dan MSE/jarak landmark ikut besar.

Output: MSE gray96, jarak landmark maks, diff image + gray96 kedua versi.
"""
import numpy as np
import cv2

S = 96
PAD = 0.15
MIN_BOX = 20
OUT = r"D:\claudeCode\SilentVoice\clip_analysis_v30"


def make_synthetic(w=640, h=480):
    """Frame dengan gradien vertikal + bibir merah + mata hijau, 5 derajat."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    gray = 1.0 - yy / h                      # atas terang, bawah gelap
    frame = np.stack([gray] * 3, axis=-1).astype(np.uint8)
    frame = (frame * 1).astype(np.uint8) * 0 + (gray * 255).astype(np.uint8)[..., None] * np.ones(3, dtype=np.uint8)[None, None, :]

    lip_c = (385, 295)
    eye_l = (250, 220)
    eye_r = (425, 226)
    cv2.circle(frame, lip_c, 38, (0, 0, 255), -1)
    cv2.circle(frame, lip_c, 16, (0, 120, 0), -1)
    for e in (eye_l, eye_r):
        cv2.rectangle(frame, (e[0] - 20, e[1] - 12), (e[0] + 20, e[1] + 12), (0, 255, 0), -1)

    pts = np.array([[lip_c[0] + 26 * np.cos(t) - 14, lip_c[1] + 12 * np.sin(t)]
                    for t in np.linspace(0, 2 * np.pi, 40, endpoint=False)], dtype=np.float32)
    l_eye = np.array(eye_l, dtype=np.float32)
    r_eye = np.array(eye_r, dtype=np.float32)
    return frame, pts, l_eye, r_eye


def crop_align_notebook(frame_bgr, lip_pts_raw, l_eye, r_eye):
    """PERSIS crop_align_visual_v2 dari cell 2.2 notebook v2."""
    h, w = frame_bgr.shape[:2]
    eye_vec = r_eye - l_eye
    angle_deg = float(np.degrees(np.arctan2(eye_vec[1], eye_vec[0])))
    center = (int(round((l_eye[0] + r_eye[0]) / 2)), int(round((l_eye[1] + r_eye[1]) / 2)))

    M = cv2.getRotationMatrix2D(center, angle_deg, 1.0)
    rotated = cv2.warpAffine(frame_bgr, M, (w, h), flags=cv2.INTER_LINEAR,
                             borderMode=cv2.BORDER_REFLECT)

    ones = np.ones((len(lip_pts_raw), 1), dtype=np.float32)
    pts_h = np.hstack([lip_pts_raw, ones])
    lip_rot = (M @ pts_h.T).T

    x_min, y_min = lip_rot.min(axis=0).astype(int)
    x_max, y_max = lip_rot.max(axis=0).astype(int)
    bw, bh = x_max - x_min, y_max - y_min
    if bw < MIN_BOX or bh < MIN_BOX:
        return None
    pad_w = int(bw * PAD); pad_h = int(bh * PAD)
    x1 = max(0, x_min - pad_w); y1 = max(0, y_min - pad_h)
    x2 = min(w, x_max + pad_w); y2 = min(h, y_max + pad_h)
    crop = rotated[y1:y2, x1:x2]
    if crop.size == 0:
        return None
    ch, cw = crop.shape[:2]
    side = max(ch, cw)
    canvas = np.zeros((side, side, 3), dtype=np.uint8)
    off_y, off_x = (side - ch) // 2, (side - cw) // 2
    canvas[off_y:off_y + ch, off_x:off_x + cw] = crop

    resized = cv2.resize(canvas, (S, S), interpolation=cv2.INTER_AREA)
    gray_full = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
    scale = S / float(side)
    lip_in_resized = (lip_rot - np.array([x1, y1], np.float32) +
                      np.array([off_x, off_y], np.float32)) * scale
    return gray_full, lip_in_resized


def _reflect(v, n):
    v = int(v)
    while v < 0 or v >= n:
        v = -v - 1 if v < 0 else 2 * n - v - 1
    return v


def _bilinear(frame, w, h, sx, sy):
    # frame adalah numpy (h, w, 3) — indeks 2D [y, x] mengambil piksel 3-kanal.
    fx0 = int(np.floor(sx)); fy0 = int(np.floor(sy))
    x0 = _reflect(fx0, w); x1 = _reflect(fx0 + 1, w)
    y0 = _reflect(fy0, h); y1 = _reflect(fy0 + 1, h)
    fx = sx - fx0; fy = sy - fy0
    def gray_at(x, y):
        b, gch, r = frame[y, x]
        return 0.299 * r + 0.587 * gch + 0.114 * b
    top = gray_at(x0, y0) * (1 - fx) + gray_at(x1, y0) * fx
    bot = gray_at(x0, y1) * (1 - fx) + gray_at(x1, y1) * fx
    return top * (1 - fy) + bot * fy


def crop_align_kotlin(frame_bgr, lip_pts_raw, l_eye, r_eye):
    """Port setia LipProcessing.kt APK #30: rotasi M (maju), sampling inverse
    dengan bilinear+reflect, window-area, canvas_coord = tx/invScale."""
    h, w = frame_bgr.shape[:2]
    ex = r_eye[0] - l_eye[0]; ey = r_eye[1] - l_eye[1]
    angle = float(np.arctan2(ey, ex))
    c = float(np.cos(angle)); s = float(np.sin(angle))
    cx = int(round((l_eye[0] + r_eye[0]) / 2)); cy = int(round((l_eye[1] + r_eye[1]) / 2))
    tx = (1 - c) * cx - s * cy
    ty = s * cx + (1 - c) * cy

    n = len(lip_pts_raw)
    lip_rot = np.empty_like(lip_pts_raw, dtype=np.float32)
    for i in range(n):
        x, y = lip_pts_raw[i]
        lip_rot[i] = [c * x + s * y + tx, -s * x + c * y + ty]

    x_min, y_min = lip_rot.min(axis=0).astype(int)
    x_max, y_max = lip_rot.max(axis=0).astype(int)
    bw = x_max - x_min; bh = y_max - y_min
    if bw < MIN_BOX or bh < MIN_BOX:
        return None
    pad_w = int(bw * PAD); pad_h = int(bh * PAD)
    x1 = max(0, x_min - pad_w); y1 = max(0, y_min - pad_h)
    x2 = min(w, x_max + pad_w); y2 = min(h, y_max + pad_h)
    cw, ch = x2 - x1, y2 - y1
    if cw <= 0 or ch <= 0:
        return None
    side = max(ch, cw)
    off_x = (side - cw) // 2; off_y = (side - ch) // 2
    inv_scale = S / float(side)
    cos_inv = c; sin_inv = -s

    gray96 = np.zeros((S, S), dtype=np.float32)
    if side > S:
        for ty in range(S):
            for tx in range(S):
                b0x = x1 + tx / inv_scale - off_x
                b1x = x1 + (tx + 1) / inv_scale - off_x
                b0y = y1 + ty / inv_scale - off_y
                b1y = y1 + (ty + 1) / inv_scale - off_y
                ix_s = max(x1, int(np.ceil(b0x))); ix_e = min(x2, int(np.floor(b1x - 1e-6)))
                iy_s = max(y1, int(np.ceil(b0y))); iy_e = min(y2, int(np.floor(b1y - 1e-6)))
                ssum = 0.0; cnt = 0
                for iy in range(iy_s, iy_e + 1):
                    for ix in range(ix_s, ix_e + 1):
                        dx = ix - cx; dy = iy - cy
                        sxv = cos_inv * dx - sin_inv * dy + cx
                        syv = sin_inv * dx + cos_inv * dy + cy
                        ssum += _bilinear(frame_bgr, w, h, sxv, syv)
                        cnt += 1
                gray96[ty, tx] = (ssum / cnt) / 255.0 if cnt else 0.0
    else:
        for ty in range(S):
            for tx in range(S):
                rx = x1 + tx / inv_scale - off_x
                ry = y1 + ty / inv_scale - off_y
                if x1 <= rx < x2 and y1 <= ry < y2:
                    dx = rx - cx; dy = ry - cy
                    gray96[ty, tx] = _bilinear(frame_bgr, w, h,
                        cos_inv * dx - sin_inv * dy + cx,
                        sin_inv * dx + cos_inv * dy + cy) / 255.0
                else:
                    gray96[ty, tx] = 0.0

    lip_resized = np.empty_like(lip_pts_raw, dtype=np.float32)
    for i in range(n):
        lip_resized[i] = (lip_rot[i] - [x1, y1] + [off_x, off_y]) * inv_scale
    return gray96, lip_resized


def main():
    frame, pts, l_eye, r_eye = make_synthetic()
    A = crop_align_notebook(frame, pts, l_eye, r_eye)
    B = crop_align_kotlin(frame, pts, l_eye, r_eye)
    assert A is not None and B is not None, "Salah satu crop None!"

    grayA, lipA = A
    grayB, lipB = B
    mse = float(np.mean((grayA - grayB) ** 2))
    err = float(np.max(np.abs(lipA - lipB)))

    print("=" * 60)
    print("PERBANDINGAN MATEMATIKA CROP (kotlin-numpy vs notebook-cv2)")
    print("MSE gray96          :", mse)
    print("Max |lipA - lipB| px:", err)
    print("Range grayA         :", round(float(grayA.min()), 4), "-", round(float(grayA.max()), 4))
    print("Range grayB         :", round(float(grayB.min()), 4), "-", round(float(grayB.max()), 4))
    print("side (canvas)       :", None)  # dihitung internal, hanya info
    print("=" * 60)

    # Simpan diff + gray96 untuk inspeksi mata
    cv2.imwrite(OUT + r"\gt_A_gray96.png", (grayA * 255).astype(np.uint8))
    cv2.imwrite(OUT + r"\gt_B_gray96.png", (grayB * 255).astype(np.uint8))
    cv2.imwrite(OUT + r"\gt_diff.png", (np.abs(grayA - grayB) * 255).astype(np.uint8))
    print("Disimpan: gt_A_gray96.png, gt_B_gray96.png, gt_diff.png")

    # Keputusan awal
    if mse < 1e-3 and err < 0.2:
        print(">> SETARA: matematika Kotlin == notebook.")
        print("   Kesimpulan -> bug ada di INPUT pipeline nyata (orientasi frame BGR vs landmark).")
    elif mse < 1e-2 and err < 1.0:
        print(">> HAMPIR setara (selisih kecil mungkin dari INTER_AREA vs window-area).")
        print("   Verifikasi diff image sebelum mengambil kesimpulan.")
    else:
        print(">> TIDAK SETARA: ada inkonsistensi matematis yang harus diperbaiki.")
        print("   Periksa diff image untuk melihat pola (rotasi/skala/translasi).")


if __name__ == "__main__":
    main()