package com.silentvoice.frameprocessor

import kotlin.math.max
import kotlin.math.sqrt

/**
 * Precompute per-clip — PERSIS algoritma precompute-lcp-v7--Multimodal.ipynb:
 *   1. Refine trim ulang segmen ucapan (smooth MAR window=3, threshold =
 *      percentile-20 + MAR_K_STD*std, segmen terpanjang, margin=max(2,len//10)).
 *   2. Ekstraksi 20 patch 10x10 dari citra align (PATCH_LIP_LOCAL_IDX genap).
 *   3. Resample temporal ke SEQ_LEN_WORD (30) frame (linear interpolation).
 *   4. Channel visual "gray+diff" (channel2 = diff temporal, prepend frame pertama).
 *   5. Landmark: 81 dims (40*2 + MAR) + 80 inter-frame motions = 161 dims.
 *
 * Output persis cocok dengan input ONNX:
 *   visual   : (1, 2, 30, 20, 10, 10) float32
 *   landmark : (1, 30, 161) float32
 */
object LipPrecompute {

    const val VISUAL_CHANNELS = 2
    const val LANDMARK_BASE_DIM = 81   // 40*2 + MAR
    const val LANDMARK_FULL_DIM = 161  // 81 + 80 motions

    /**
     * Proses clip -> pasangan tensor siap ONNX (kosong kalau tidak valid).
     * Segmen ucapan (findSpeechInterval) dipakai juga oleh DebugClipSaver via speechIndices.
     */
    fun precomputeClip(clip: List<LipFrame>): Pair<FloatArray, FloatArray> {
        val n = clip.size

        // [FIX D3] Persis notebook process_video_dual: n_valid < 4 -> tolak.
        // (Notebook: `if n_valid < 4: raise`; precompute Kotlin harus menolak clip
        // dengan < 4 frame valid, bukan memprosesnya dengan 2–3 frame.)
        val all = (0 until n).filter { clip[it].landmarkDetected }
        if (all.size < 4) return Pair(FloatArray(0), FloatArray(0))

        val indices = speechIndices(clip)
        if (indices.size < 4) {
            // Fallback: semua frame valid (tambahan Kotlin — notebook tidak punya
            // jalur ini; hanya dipakai bila segmen MAR gagal didefinisikan).
            return buildTensors(clip, all)
        }
        return buildTensors(clip, indices)
    }

    /**
     * Index frame yang masuk inference: segmen ucapan dari findSpeechInterval —
     * satu sumber kebenaran, dipakai bersama oleh precomputeClip & DebugClipPreview.
     */
    fun speechIndices(clip: List<LipFrame>): List<Int> {
        val n = clip.size
        if (n < 2) return emptyList()

        // 1. Refine trim segmen ucapan
        val marArr = FloatArray(n) { clip[it].mar }
        val (onset, offset) = findSpeechInterval(marArr)
        return (onset..offset).filter { clip[it].landmarkDetected }
    }

    private fun buildTensors(clip: List<LipFrame>, indices: List<Int>): Pair<FloatArray, FloatArray> {
        val T = LipConfig.SEQ_LEN_WORD
        val K = LipConfig.NUM_VISUAL_LANDMARKS
        val P = LipConfig.PATCH_SIZE
        val n = indices.size

        // Per-frame: visual (K*P*P) dan landmark (81)
        val visSeq = Array(n) { FloatArray(K * P * P) }
        val lmSeq  = Array(n) { FloatArray(LANDMARK_BASE_DIM) }
        for (fi in 0 until n) {
            val f = clip[indices[fi]]
            visSeq[fi] = extractPatches(f.grayAligned, f.lipPtsResized)
            lmSeq[fi]  = buildLandmarkFeature(f)
        }

        // Resample temporal ke T frame
        val visResampled = resampleSeq(visSeq, T)   // (T, K*P*P)
        val lmResampled  = resampleSeq(lmSeq, T)    // (T, 81)

        // Channel visual gray + diff -> (T, K, P, P, 2)
        // NOTE: visResampled adalah Array<FloatArray> (2D): visResampled[t][idx]
        val visOut = FloatArray(T * K * P * P * VISUAL_CHANNELS)
        for (t in 0 until T) {
            for (k in 0 until K) {
                for (py in 0 until P) {
                    for (px in 0 until P) {
                        val idx = k * P * P + py * P + px
                        val gray = visResampled[t][idx]
                        val diff = if (t == 0) 0f else visResampled[t][idx] - visResampled[t - 1][idx]
                        val outIdx = (t * K * P * P + idx) * 2
                        visOut[outIdx]     = gray
                        visOut[outIdx + 1] = diff
                    }
                }
            }
        }

        // Landmark 161 = 81 + 80 motions (cur - prev, prepend frame pertama)
        // NOTE: lmResampled adalah Array<FloatArray> (2D): lmResampled[t][d]
        val lmOut = FloatArray(T * LANDMARK_FULL_DIM)
        for (t in 0 until T) {
            // 81 dims landmark
            System.arraycopy(lmResampled[t], 0, lmOut, t * LANDMARK_FULL_DIM, LANDMARK_BASE_DIM)
            // 80 dims motion
            for (d in 0 until 80) {
                val cur  = lmResampled[t][d]
                val prev = if (t == 0) cur else lmResampled[t - 1][d]
                lmOut[t * LANDMARK_FULL_DIM + LANDMARK_BASE_DIM + d] = cur - prev
            }
        }

        return Pair(visOut, lmOut)
    }

    /** Smooth MAR (window=3, mode=nearest) — persis smooth_mar notebook. */
    private fun smoothMar(mar: FloatArray): FloatArray {
        val w = LipConfig.MAR_SMOOTH_WIN
        val n = mar.size
        val out = FloatArray(n)
        val half = w / 2
        for (i in 0 until n) {
            var sum = 0f
            var cnt = 0
            for (j in (i - half)..(i + half)) {
                val idx = when {
                    j < 0 -> 0
                    j >= n -> n - 1
                    else -> j
                }
                sum += mar[idx]
                cnt++
            }
            out[i] = sum / cnt
        }
        return out
    }

    /** Label segmen beruntun + ambil segmen terpanjang — persis find_speech_interval. */
    private fun findSpeechInterval(mar: FloatArray): Pair<Int, Int> {
        val smoothed = smoothMar(mar)
        val n = smoothed.size

        // [FIX F1] np.percentile(smoothed, 20) memakai interpolasi linear (metode
        // default 'linear'): bila indeks non-integer, hasil = lerp dua nilai terdekat.
        // Implementasi lama pakai index terdekat (sorted[(n-1)*0.2]) — beda kecil
        // pada n kecil (clip 20–200 frame). Sekarang persis np.percentile.
        val sorted = smoothed.sorted()
        val p20Pos = (n - 1) * 0.20
        val p20Low = sorted[Math.floor(p20Pos).toInt().coerceIn(0, n - 1)]
        val p20High = sorted[Math.ceil(p20Pos).toInt().coerceIn(0, n - 1)]
        val p20Frac = p20Pos - Math.floor(p20Pos)
        val baseline = (p20Low + (p20High - p20Low) * p20Frac).toFloat()
        val mean = smoothed.average().toFloat()
        val variance = smoothed.map { (it - mean) * (it - mean) }.average().toFloat()
        val std = sqrt(variance) + 1e-6f
        val threshold = baseline + LipConfig.MAR_K_STD * std

        val active = BooleanArray(n) { smoothed[it] > threshold }

        val labels = IntArray(n) { 0 }
        var segCount = 0
        var i = 0
        while (i < n) {
            if (active[i]) {
                segCount++
                var j = i
                while (j < n && active[j]) { labels[j] = segCount; j++ }
                i = j
            } else {
                i++
            }
        }

        if (segCount == 0) return Pair(0, n - 1)

        var bestSeg = 1
        var bestLen = 0
        for (sid in 1..segCount) {
            val len = labels.count { it == sid }
            if (len > bestLen) { bestLen = len; bestSeg = sid }
        }

        val idxs = (0 until n).filter { labels[it] == bestSeg }
        val margin = max(2, bestLen / 10)
        val onset  = max(0, idxs.first() - margin)
        val offset = minOf(n - 1, idxs.last() + margin)
        return Pair(onset, offset)
    }

    /** Ekstraksi 20 patch 10x10 di sekitar titik visual — persis extract_patches. */
    private fun extractPatches(gray96: FloatArray, lipResized: FloatArray): FloatArray {
        val P = LipConfig.PATCH_SIZE
        val K = LipConfig.NUM_VISUAL_LANDMARKS
        val S = LipConfig.TARGET_SIZE
        val half = P / 2

        // Zero-pad gambar
        val padded = FloatArray((S + P) * (S + P))
        for (y in 0 until S) {
            System.arraycopy(gray96, y * S, padded, (y + half) * (S + P) + half, S)
        }

        val out = FloatArray(K * P * P)
        for (oi in 0 until K) {
            val localIdx = LipConfig.PATCH_LOCAL_IDX[oi]
            // [FIX G1] Persis notebook extract_patches:
            //   xi = int(np.clip(round(x), 0, W-1)) — ROUND dulu, baru CLIP, baru int.
            // Implementasi lama: coerce dulu lalu truncate (bedanya &plusmn;1 px pada .5).
            val xiRaw = Math.round(lipResized[localIdx * 2])
            val yiRaw = Math.round(lipResized[localIdx * 2 + 1])
            val xi = xiRaw.coerceIn(0, S - 1)
            val yi = yiRaw.coerceIn(0, S - 1)

            val padX = xi + half
            val padY = yi + half
            for (py in 0 until P) {
                for (px in 0 until P) {
                    out[oi * P * P + py * P + px] = padded[(padY + py - half) * (S + P) + (padX + px - half)]
                }
            }
        }
        return out
    }

    /** Fitur landmark: concat([normed (80), MAR]) = 81 dims. */
    private fun buildLandmarkFeature(f: LipFrame): FloatArray {
        val lm = FloatArray(LANDMARK_BASE_DIM)
        System.arraycopy(f.lipNormed, 0, lm, 0, 80)
        lm[80] = f.mar
        return lm
    }

    /** Resample temporal linear interp per-elemen — persis resample_seq. */
    private fun resampleSeq(seq: Array<FloatArray>, targetLen: Int): Array<FloatArray> {
        val n = seq.size
        if (n == targetLen) return seq
        val dim = seq[0].size
        val out = Array(targetLen) { FloatArray(dim) }

        for (col in 0 until dim) {
            for (t in 0 until targetLen) {
                val pos = if (targetLen == 1) 0.0 else t.toDouble() * (n - 1) / (targetLen - 1)
                val i0 = pos.toInt()
                val i1 = minOf(n - 1, i0 + 1)
                val frac = (pos - i0).toFloat()
                out[t][col] = seq[i0][col] * (1f - frac) + seq[i1][col] * frac
            }
        }
        return out
    }
}
