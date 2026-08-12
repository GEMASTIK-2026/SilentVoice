package com.silentvoice.frameprocessor

import android.content.Context
import android.content.pm.ApplicationInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer

/**
 * Inspector clip — HANYA AKTIF saat build DEBUG (flag FLAG_DEBUGGABLE).
 * Menyimpan bukti visual ke files/debug_clip/ supaya bisa diverifikasi:
 *
 *   clip_<seqId>/frame_<i>.png       — gray 96x96 naik 3x (288px) + titik landmark bibir
 *                                      + label frame & MAR + border merah saat masuk segmen
 *   clip_<seqId>/resample_<t>.png    — 30 frame HASIL RESAMPLE temporal (proxy visual
 *                                      dari yang masuk tensor ONNX)
 *   clip_<seqId>/meta.csv            — frame | mar | ts | pre_roll | segment
 *
 * Guard: isDebug() memeriksa FLAG_DEBUGGABLE — kosong di release build.
 * Tidak menyentuh jalur capture sama sekali; dipanggil HANYA dari handleClipReady
 * setelah precompute sukses, di thread background yang sama.
 */
object DebugClipSaver {

    private const val TAG = "DebugClipSaver"
    private const val UPSCALE = 3                 // 96 -> 288 px
    private const val BASE_DIR = "debug_clip"
    private const val MAX_KEEP = 5                // simpan maks 5 clip terbaru

    /** Hanya jalankan saat APK ini debuggable (debug build). */
    fun isDebug(context: Context): Boolean =
        (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

    /**
     * Simpan satu clip penuh + 30 frame resample ke disk.
     * Dipanggil hanya di jalur precompute sukses; return tanpa-efek kalau bukan debug.
     *
     * @param rawBgr snapshot frame BGR MENTAH (dari lastBgrBytes saat clip di-emit) —
     *               untuk memverifikasi ORIENTASI buffer kamera
     * @param frameW/ frameH/ orientationDeg metadata buffer asli
     * @param rawLandmarks 84 float: 40 titik bibir (x,y) + lEye (x,y) + rEye (x,y),
     *               koordinat piksel ASLI frame — untuk overlay verifikasi "landmark vs bibir"
     */
    fun save(context: Context, seqId: Long, clip: List<LipFrame>,
             rawBgr: ByteArray, frameW: Int, frameH: Int, orientationDeg: Int,
             rawLandmarks: FloatArray) {
        if (!isDebug(context)) return
        try {
            val root = File(context.getExternalFilesDir(null), BASE_DIR)
            val dir = File(root, "clip_$seqId")
            dir.mkdirs()
            cleanupOld(root)

            // Segmen ucapan yang BENAR-BENAR dipakai ONNX (sama dengan precomputeClip)
            val indices = LipPrecompute.speechIndices(clip)
            val onset = indices.firstOrNull() ?: 0
            val offset = indices.lastOrNull() ?: 0
            val inSegment = indices.toSet()

            // 1. meta.csv — frame | mar | timestampMs | pre_roll | segment
            val meta = StringBuilder("frame,mar,timestampMs,pre_roll,segment\n")
            for (i in clip.indices) {
                val pre = if (i < LipConfig.RING_BUFFER_SIZE) 1 else 0
                val seg = if (i in inSegment) 1 else 0
                meta.append("$i,${clip[i].mar},${clip[i].timestampMs},$pre,$seg\n")
            }
            File(dir, "meta.csv").writeText(meta.toString())

            // 1b. BUKTI ORIENTASI CAMERA: frame BGR MENTAH + metadata.
            //     Hanya debug — untuk memverifikasi apakah buffer kamera masih orientasi
            //     SENSOR (miring 90°/terbalik) vs tampilan preview yang di-rotasi UI.
            //     Catatan jujur: ini SNAPSHOT terakhir sebelum emit, bukan frame segmen
            //     tertentu — cukup untuk melihat orientasi, tidak untuk per-frame.
            try {
                val rawDir = File(dir, "raw")
                rawDir.mkdirs()
                File(rawDir, "meta.txt").writeText(
                    "w=$frameW h=$frameH orient=$orientationDeg snapshot=lastBgrBeforeEmit\n")
                if (rawBgr.isNotEmpty()) {
                    File(rawDir, "frame_0000.bgr").writeBytes(rawBgr)
                }
                // Landmark MENTAH (84 float = 42 titik × 2) — koordinat piksel asli frame.
                if (rawLandmarks.isNotEmpty()) {
                    val buf = ByteBuffer.allocate(rawLandmarks.size * 4).also { b ->
                        b.asFloatBuffer().put(rawLandmarks)
                    }
                    File(rawDir, "landmarks.bin").writeBytes(buf.array())
                    File(rawDir, "landmarks_meta.txt").writeText(
                        "count=42 format=x,y_per_point order=40lips,lEye,rEye coords=pixel_original_frame\n")
                }
            } catch (e: Exception) {
                Log.e(TAG, "save raw gagal: ${e.message}")
            }

            // 2. Frame RAW per frame — pre-roll ditandai label, segmen diberi border
            for (i in clip.indices) {
                val f = clip[i]
                val label = if (i < LipConfig.RING_BUFFER_SIZE) {
                    "PRE-ROLL f$i MAR=%.3f".format(f.mar)
                } else {
                    "f$i MAR=%.3f".format(f.mar)
                }
                savePng(File(dir, "frame_%04d.png".format(i)),
                    render(f.grayAligned, f.lipPtsResized, label, i in inSegment))
            }

            // 3. 30 frame hasil resample temporal — persis alur ONNX (resample_seq)
            val graySeq = indices.map { clip[it].grayAligned }.toTypedArray()
            val lipSeq = indices.map { clip[it].lipPtsResized }.toTypedArray()
            val (gOut, lOut) = resampleTemporal(graySeq, lipSeq, LipConfig.SEQ_LEN_WORD)
            for (t in gOut.indices) {
                savePng(File(dir, "resample_%02d.png".format(t)),
                    render(gOut[t], lOut[t], "onnx t=$t/${gOut.size}", true))
            }

            Log.d(TAG, "Clip $seqId tersimpan: ${clip.size} frame, segmen [$onset..$offset] " +
                    "(${indices.size} frame) -> ${dir.absolutePath}")
        } catch (e: Exception) {
            Log.e(TAG, "Save clip $seqId gagal: ${e.message}")
        }
    }

    /**
     * Resample temporal linear per-elemen — formula persis resample_seq notebook:
     * pos = t * (n-1) / (targetLen-1), interpolasi linier antar frame.
     * Menerapkan pada gray 96x96 dan landmark agar bisa dirender sebagai video.
     */
    private fun resampleTemporal(seqG: Array<FloatArray>, seqL: Array<FloatArray>,
                                 targetLen: Int): Pair<Array<FloatArray>, Array<FloatArray>> {
        val n = seqG.size
        if (n == targetLen) return Pair(seqG, seqL)
        val dimG = seqG[0].size
        val dimL = seqL[0].size
        val outG = Array(targetLen) { FloatArray(dimG) }
        val outL = Array(targetLen) { FloatArray(dimL) }

        fun interp(seq: Array<FloatArray>, dim: Int, out: Array<FloatArray>) {
            for (col in 0 until dim) {
                for (t in 0 until targetLen) {
                    val pos = if (targetLen == 1) 0.0 else t.toDouble() * (n - 1) / (targetLen - 1)
                    val i0 = pos.toInt()
                    val i1 = minOf(n - 1, i0 + 1)
                    val frac = (pos - i0).toFloat()
                    out[t][col] = seq[i0][col] * (1f - frac) + seq[i1][col] * frac
                }
            }
        }
        interp(seqG, dimG, outG)
        interp(seqL, dimL, outL)
        return Pair(outG, outL)
    }

    /** 96x96 gray -> Bitmap 288x288 + titik landmark (merah) + label + border segmen. */
    private fun render(gray: FloatArray, lip: FloatArray,
                       label: String, inSegment: Boolean): Bitmap {
        val s = LipConfig.TARGET_SIZE * UPSCALE
        val bmp = Bitmap.createBitmap(s, s, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        val px = IntArray(s * s)

        // Auto-contrast: regangkan rentang gray [min..max] ke [0..255] supaya
        // frame gelap (bibir kecil/remang) pun terlihat jelas saat inspeksi.
        var mn = 1f; var mx = 0f
        for (gv in gray) {
            if (gv > 0f) { if (gv < mn) mn = gv; if (gv > mx) mx = gv }
        }
        val allZero = mx <= mn                      // frame kosong total (crop gagal)
        val span = (mx - mn).takeIf { it > 0.05f } ?: 1f

        for (y in 0 until s) {
            val gy = (y / UPSCALE) * LipConfig.TARGET_SIZE
            for (x in 0 until s) {
                val gv = gray[gy + x / UPSCALE]
                val g = if (allZero) 0 else (((gv - mn) / span) * 255f).toInt().coerceIn(0, 255)
                px[y * s + x] = (0xFF shl 24) or (g shl 16) or (g shl 8) or g
            }
        }
        bmp.setPixels(px, 0, s, 0, 0, s, s)

        if (lip.isNotEmpty()) {
            val dot = Paint().apply {
                color = Color.RED; style = Paint.Style.FILL; isAntiAlias = true
            }
            for (i in lip.indices step 2) {
                canvas.drawCircle(lip[i] * UPSCALE, lip[i + 1] * UPSCALE, 5f, dot)
            }
        }
        if (inSegment) {
            val border = Paint().apply {
                color = Color.rgb(255, 80, 80); style = Paint.Style.STROKE; strokeWidth = 6f
            }
            canvas.drawRect(2f, 2f, (s - 2).toFloat(), (s - 2).toFloat(), border)
        }
        if (label.isNotBlank()) {
            val tp = Paint().apply {
                color = Color.GREEN; textSize = 17f; typeface = Typeface.MONOSPACE; isAntiAlias = true
            }
            canvas.drawText(label, 8f, 30f, tp)
        }
        return bmp
    }

    private fun savePng(file: File, bmp: Bitmap) {
        try {
            FileOutputStream(file).use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
        } catch (e: Exception) {
            Log.e(TAG, "PNG gagal ${file.name}: ${e.message}")
        }
    }

    /** Hapus folder tertua saat cache melebihi 5 clip (mencegah disk penuh). */
    private fun cleanupOld(root: File) {
        try {
            var dirs = root.listFiles()?.filter { it.isDirectory && it.name.startsWith("clip_") }
                ?.sortedByDescending { it.name } ?: return
            while (dirs.size > MAX_KEEP) {
                dirs.last().deleteRecursively()
                dirs = dirs.dropLast(1)
            }
        } catch (e: Exception) {
            Log.e(TAG, "cleanup gagal: ${e.message}")
        }
    }
}
