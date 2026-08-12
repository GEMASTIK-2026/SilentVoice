package com.silentvoice.frameprocessor

/**
 * Konstanta preprocessing — SUMBER KEBENARAN dari precompute-lcp-v7--Multimodal.ipynb.
 * JANGAN UBAH: TARGET_SIZE 96x96, PATCH_SIZE 10, NUM_VISUAL_LANDMARKS 20,
 * SEQ_LEN_WORD 30, MAR_K_STD 0.5, MAR_SMOOTH_WIN 3, PAD_RATIO 0.15, MIN_BOX_SIZE 20.
 * VISUAL_MODE = "gray+diff" (2 channel).
 */
object LipConfig {
    const val TARGET_SIZE = 96
    const val PATCH_SIZE = 10
    const val NUM_VISUAL_LANDMARKS = 20
    const val SEQ_LEN_WORD = 30
    const val MAR_K_STD = 0.5f          // baseline (nilai notebook, jangan diubah)
    const val MAR_K_STD_OPEN = 1.5f     // hysteresis BUKA: trigger saat MAR melewati +1.5σ baseline
    const val MAR_K_STD_CLOSE = 0.5f    // hysteresis TUTUP: berhenti saat MAR kembali ≤ +0.5σ — anti-goyang
    const val MAR_SMOOTH_WIN = 3
    const val PAD_RATIO = 0.15f
    const val MIN_BOX_SIZE = 20
    const val RING_BUFFER_SIZE = 20      // pre-roll frame (baseline MAR + pre-roll clip)
    const val MAX_CLIP_MS = 8000L        // timeout maksimum 8 detik
    const val CLOSE_STABLE_FRAMES = 20   // mulut tertutup stabil utk stop

    // 40 titik bibir unik (MediaPipe index), terurut — dari LIPS_IDX
    val LIPS_IDX = intArrayOf(
        0, 13, 14, 17, 37, 39, 40, 61, 78, 80, 81, 82, 84, 87, 88, 91, 95,
        146, 178, 181, 185, 191, 267, 269, 270, 291, 308, 310, 311, 312, 314,
        317, 318, 321, 324, 375, 402, 405, 409, 415
    )

    // PATCH_LIP_LOCAL_IDX = genap 0..38 (20 titik visual)
    val PATCH_LOCAL_IDX = IntArray(NUM_VISUAL_LANDMARKS) { it * 2 }

    // Posisi titik MAR di ruang LIPS_IDX (lokal)
    const val MAR_TOP_LOCAL = 1    // global 13
    const val MAR_BOT_LOCAL = 2    // global 14
    const val MAR_LEFT_LOCAL = 8   // global 78
    const val MAR_RIGHT_LOCAL = 26 // global 308

    // Mata untuk normalisasi (MediaPipe index)
    const val LEFT_EYE_OUTER = 33
    const val RIGHT_EYE_OUTER = 263
}

/**
 * Representasi per-frame hasil deteksi & align.
 */
data class LipFrame(
    val grayAligned: FloatArray,      // 96x96 grayscale [0..1], row-major
    val lipPtsResized: FloatArray,    // 40 titik (x,y) di ruang hasil align (96x96) — untuk ekstraksi patch
    val lipNormed: FloatArray,        // 40 titik (x,y) TERNORMALISASI (rotate+scale+center) — untuk fitur landmark 81 dims
    val mar: Float,                   // Mouth Aspect Ratio (ternormalisasi)
    val timestampMs: Long,
    val landmarkDetected: Boolean
) {
    companion object {
        const val GRAY_SIZE = LipConfig.TARGET_SIZE * LipConfig.TARGET_SIZE
    }
}

/**
 * Pipeline per-frame: normalisasi landmark, hitung MAR, crop-align visual.
 * Persis mengikuti notebook precompute:
 *  - normalize_landmark: rotate ke arah mata, scale ÷ jarak mata, center ke mean bibir
 *  - compute_mar: jarak(13,14) / jarak(78,308) pada koordinat ternormalisasi
 *  - crop_align_visual_v2: rotasi affine, crop bbox bibir + pad 15%, canvas persegi,
 *    resize 96x96, grayscale /255, petakan landmark ke ruang hasil resize
 */
object LipPipeline {

    /**
     * Proses satu frame: terima landmark mentah + frame BGR.
     * Mengembalikan LipFrame lengkap, atau null kalau landmark tidak valid.
     *
     * @param lipGlobal 40 titik bibir (x,y) dalam piksel frame asli
     * @param lEye      titik mata kiri (x,y)
     * @param rEye      titik mata kanan (x,y)
     * @param frame     frame BGR (byte array, row-major, 3 channel per piksel)
     * @param w         lebar frame
     * @param h         tinggi frame
     * @param ts        timestamp frame (ms)
     */
    fun process(lipGlobal: Array<FloatArray>, lEye: FloatArray, rEye: FloatArray,
                frame: ByteArray, w: Int, h: Int, ts: Long): LipFrame? {
        if (lipGlobal.size != LipConfig.LIPS_IDX.size) return null

        // 1. Normalisasi landmark (persis normalize_landmark) — untuk fitur landmark 81 dims & MAR
        val normed = normalizeLandmark(lipGlobal, lEye, rEye)

        // 2. MAR (persis compute_mar)
        val mar = computeMar(normed)

        // 3. Crop-align visual (persis crop_align_visual_v2)
        val align = cropAlignVisual(frame, w, h, lipGlobal, lEye, rEye) ?: return null
        val (gray96, lipResized) = align

        return LipFrame(gray96, lipResized, normed, mar, ts, true)
    }

    /** (centered @ rot^T) / eye_dist */
    fun normalizeLandmark(lip: Array<FloatArray>, lEye: FloatArray, rEye: FloatArray): FloatArray {
        val n = lip.size
        // mean bibir
        var mx = 0f; var my = 0f
        for (i in 0 until n) { mx += lip[i][0]; my += lip[i][1] }
        mx /= n; my /= n

        val ex = rEye[0] - lEye[0]
        val ey = rEye[1] - lEye[1]
        val eyeDist = kotlin.math.sqrt(ex * ex + ey * ey) + 1e-6f
        val angle = kotlin.math.atan2(ey, ex)
        val c = kotlin.math.cos(-angle).toFloat()
        val s = kotlin.math.sin(-angle).toFloat()

        val out = FloatArray(n * 2)
        for (i in 0 until n) {
            val dx = lip[i][0] - mx
            val dy = lip[i][1] - my
            out[i * 2]     = (dx * c - dy * s) / eyeDist
            out[i * 2 + 1] = (dx * s + dy * c) / eyeDist
        }
        return out
    }

    /** MAR = |top-bot| / (|left-right| + 1e-6) pada koordinat ternormalisasi */
    fun computeMar(normed: FloatArray): Float {
        val ti = LipConfig.MAR_TOP_LOCAL * 2
        val bi = LipConfig.MAR_BOT_LOCAL * 2
        val li = LipConfig.MAR_LEFT_LOCAL * 2
        val ri = LipConfig.MAR_RIGHT_LOCAL * 2

        val vx = normed[ti] - normed[bi]; val vy = normed[ti + 1] - normed[bi + 1]
        val hx = normed[li] - normed[ri]; val hy = normed[li + 1] - normed[ri + 1]
        val vert = kotlin.math.sqrt(vx * vx + vy * vy)
        val horiz = kotlin.math.sqrt(hx * hx + hy * hy) + 1e-6f
        return vert / horiz
    }

    /**
     * Crop-align visual v2 (persis notebook):
     * rotasi affine (sudut mata), crop bbox bibir + pad, canvas persegi, resize 96x96,
     * grayscale /255, petakan landmark ke koordinat hasil resize.
     */
    fun cropAlignVisual(frame: ByteArray, w: Int, h: Int,
                        lip: Array<FloatArray>, lEye: FloatArray, rEye: FloatArray):
            Pair<FloatArray, FloatArray>? {

        // Sudut rotasi dari vektor mata (derajat, persis cv2.getRotationMatrix2D)
        val ex = rEye[0] - lEye[0]
        val ey = rEye[1] - lEye[1]
        val angleDeg = Math.toDegrees(Math.atan2(ey.toDouble(), ex.toDouble()))
        // [FIX C3] Pivot = int(round(...)) persis notebook (bukan truncation).
        // Notebook: center_pt = (int(round((l_eye[0]+r_eye[0])/2.0)), int(round(...)))
        val cx = Math.round((lEye[0] + rEye[0]) / 2.0).toInt()
        val cy = Math.round((lEye[1] + rEye[1]) / 2.0).toInt()

        // Rotasi affine 2D: [cos, sin, tx; -sin, cos, ty] dengan pivot (cx,cy)
        val rad = Math.toRadians(angleDeg)
        val cos = Math.cos(rad).toFloat()
        val sin = Math.sin(rad).toFloat()
        val tx = (1f - cos) * cx - sin * cy
        val ty = sin * cx + (1f - cos) * cy

        // Rotasikan titik bibir (persis lip_rot = (M @ pts_h.T).T)
        val n = lip.size
        val lipRot = Array(n) { FloatArray(2) }
        for (i in 0 until n) {
            val x = lip[i][0]; val y = lip[i][1]
            lipRot[i][0] = cos * x + sin * y + tx
            lipRot[i][1] = -sin * x + cos * y + ty
        }

        // Bbox bibir
        var xMin = Float.MAX_VALUE; var yMin = Float.MAX_VALUE
        var xMax = -Float.MAX_VALUE; var yMax = -Float.MAX_VALUE
        for (i in 0 until n) {
            xMin = minOf(xMin, lipRot[i][0]); yMin = minOf(yMin, lipRot[i][1])
            xMax = maxOf(xMax, lipRot[i][0]); yMax = maxOf(yMax, lipRot[i][1])
        }
        val bw = (xMax - xMin).toInt(); val bh = (yMax - yMin).toInt()
        if (bw < LipConfig.MIN_BOX_SIZE || bh < LipConfig.MIN_BOX_SIZE) return null

        // Pad
        val padW = (bw * LipConfig.PAD_RATIO).toInt()
        val padH = (bh * LipConfig.PAD_RATIO).toInt()
        val x1 = maxOf(0, xMin.toInt() - padW); val y1 = maxOf(0, yMin.toInt() - padH)
        val x2 = minOf(w, (xMax.toInt() + padW)); val y2 = minOf(h, (yMax.toInt() + padH))
        val cw = x2 - x1; val ch = y2 - y1
        if (cw <= 0 || ch <= 0) return null

        // Canvas persegi
        val side = maxOf(ch, cw)
        val offX = (side - cw) / 2; val offY = (side - ch) / 2

        // Rotate & crop dengan SAMPLING YANG SETIA KE NOTEBOOK:
        //  cv2.warpAffine(frame, M, (w,h), INTER_LINEAR, BORDER_REFLECT)
        //  lalu cv2.resize(canvas, (96,96), INTER_AREA).
        //  - Luar bingkai: BORDER_REFLECT (cermin tanpa ulang tepi) — BUKAN hitam,
        //    supaya frame di tepi kamera tetap berisi bibir nyata (fix frame hitam).
        //  - Rotasi: bilinear (INTER_LINEAR); resize: rata-rata wilayah (INTER_AREA).
        val gray96 = FloatArray(LipConfig.TARGET_SIZE * LipConfig.TARGET_SIZE)
        val S = LipConfig.TARGET_SIZE
        val invScale = S.toFloat() / side.toFloat()

        val cosInv = cos; val sinInv = -sin

        for (ty in 0 until S) {
            for (tx in 0 until S) {
                // Pemetaan output (tx,ty) → ruang ROTATED — PERSIS notebook v2:
                //   canvas_coord u = tx·(side/96) = tx/invScale (invScale = 96/side)
                //   rot_x = x1 + u - offX ; rot_y = y1 + u - offY
                // Pemetaan landmark memakai skala ini juga — SATU sistem koordinat.
                if (side > S) {
                    // INTER_AREA: rata-rata seluruh piksel sumber dalam wilayah output.
                    // Pemetaan region (tx,ty) -> ruang ROTATED harus KEBALIKAN skala
                    // resample: canvas_coord = tx*(side/96) = tx/invScale (invScale=96/side).
                    // BUG LAMA: tx*invScale — salah arah skala -> window loncat keluar bbox
                    // bibir (crop kecil -> sampel jauh di luar; crop besar -> menyusut),
                    // itulah akar "clip tidak berisi bibir" sejak APK #25 (landmark benar,
                    // gambar salah — dua sistem koordinat tidak konsisten).
                    val b0x = x1 + tx / invScale - offX
                    val b1x = x1 + (tx + 1) / invScale - offX
                    val b0y = y1 + ty / invScale - offY
                    val b1y = y1 + (ty + 1) / invScale - offY
                    // Batasi wilayah ke crop bbox [x1..x2]x[y1..y2] — luar crop = 0,
                    // persis zero-pad canvas persegi di notebook (bukan refleksi)
                    val ixS = maxOf(x1, kotlin.math.ceil(b0x.toDouble()).toInt())
                    val ixE = minOf(x2, kotlin.math.floor(b1x - 1e-6).toInt())
                    val iyS = maxOf(y1, kotlin.math.ceil(b0y.toDouble()).toInt())
                    val iyE = minOf(y2, kotlin.math.floor(b1y - 1e-6).toInt())
                    var sum = 0f
                    var cnt = 0
                    for (iy in iyS..iyE) {
                        for (ix in ixS..ixE) {
                            val dx = ix - cx
                            val dy = iy - cy
                            sum += sampleReflect(frame, w, h,
                                cosInv * dx - sinInv * dy + cx,
                                sinInv * dx + cosInv * dy + cy)
                            cnt++
                        }
                    }
                    gray96[ty * S + tx] = if (cnt == 0) 0f else (sum / cnt) / 255f
                } else {
                    // Upscale (side <= 96): INTER_AREA ≈ INTER_LINEAR — satu titik bilinear.
                    // Sama: canvas_coord = tx/invScale (bukan tx*invScale — lihat bug lama di atas).
                    val rx = x1 + tx / invScale - offX
                    val ry = y1 + ty / invScale - offY
                    if (rx >= x1 && rx < x2 && ry >= y1 && ry < y2) {
                        val dx = rx - cx
                        val dy = ry - cy
                        gray96[ty * S + tx] = sampleReflect(frame, w, h,
                            cosInv * dx - sinInv * dy + cx,
                            sinInv * dx + cosInv * dy + cy) / 255f
                    } else {
                        gray96[ty * S + tx] = 0f
                    }
                }
            }
        }

        // Petakan landmark ke ruang hasil resize (persis lip_in_resized)
        val lipResized = FloatArray(n * 2)
        for (i in 0 until n) {
            val lx = lipRot[i][0] - x1 + offX
            val ly = lipRot[i][1] - y1 + offY
            lipResized[i * 2]     = lx * invScale
            lipResized[i * 2 + 1] = ly * invScale
        }

        return Pair(gray96, lipResized)
    }

    /**
     * Sampling satu titik dengan:
     *  - BORDER_REFLECT (persis cv2.BORDER_REFLECT: cermin tanpa ulang tepi) —
     *    koordinat di luar bingkai DICERMINKAN, bukan diisi hitam (fix frame hitam)
     *  - Interpolasi bilinear (persis cv2.INTER_LINEAR rotasi notebook)
     *  - Grayscale BT.601 (persis cv2.cvtColor BGR2GRAY), output [0, 255]
     */
    private fun sampleReflect(frame: ByteArray, w: Int, h: Int, sx: Float, sy: Float): Float {
        if (frame.isEmpty()) return 0f
        // Refleksi ke rentang [0, n-1]; diulang utk koordinat jauh (rotasi besar)
        fun reflect(f: Int, n: Int): Int {
            var v = f
            while (v < 0 || v >= n) {
                v = if (v < 0) -v - 1 else 2 * n - v - 1
            }
            return v
        }
        val fx0 = kotlin.math.floor(sx).toInt()
        val fy0 = kotlin.math.floor(sy).toInt()
        val x0 = reflect(fx0, w); val x1 = reflect(fx0 + 1, w)
        val y0 = reflect(fy0, h); val y1 = reflect(fy0 + 1, h)
        val fx = sx - fx0
        val fy = sy - fy0
        fun gray(idxX: Int, idxY: Int): Float {
            val si = (idxY * w + idxX) * 3
            val b = (frame[si].toInt() and 0xFF).toFloat()
            val g = (frame[si + 1].toInt() and 0xFF).toFloat()
            val r = (frame[si + 2].toInt() and 0xFF).toFloat()
            return 0.299f * r + 0.587f * g + 0.114f * b
        }
        val g00 = gray(x0, y0); val g10 = gray(x1, y0)
        val g01 = gray(x0, y1); val g11 = gray(x1, y1)
        val top = g00 * (1 - fx) + g10 * fx
        val bot = g01 * (1 - fx) + g11 * fx
        return top * (1 - fy) + bot * fy
    }
}
