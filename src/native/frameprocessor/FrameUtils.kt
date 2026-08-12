package com.silentvoice.frameprocessor

import android.media.Image
import android.util.Log
import java.nio.ByteBuffer

/**
 * Konversi frame kamera YUV_420_888 (android.media.Image) ke format yang
 * dibutuhkan pipeline (NV21 untuk MediaPipe, BGR untuk visual patches).
 *
 * PENTING: baca buffer PER-BARIS dengan batas remaining() — jangan
 * get(array, 0, rowStride * height) sekaligus, karena buffer sebenarnya
 * di perangkat bisa lebih kecil dari kalkulasi ideal → BufferUnderflowException
 * (terbukti dari stack trace APK #18: FrameUtils.kt:38).
 */
object FrameUtils {

    private const val TAG = "FrameUtils"

    /**
     * YUV_420_888 (android.media.Image) -> buffer NV21 (Y + interleaved VU).
     * MediaPipe Tasks (ByteBufferImageBuilder) menerima NV21 — jauh lebih ringan
     * daripada konversi ke Bitmap RGBA_8888 per frame.
     */
    fun yuv420ToNv21(image: Image, w: Int, h: Int): ByteBuffer {
        val planes = image.planes
        val yPlane = planes[0]
        val uPlane = planes[1]
        val vPlane = planes[2]

        val yRowStride = yPlane.rowStride
        val uRowStride = uPlane.rowStride
        val vRowStride = vPlane.rowStride

        val uvW = (w + 1) / 2
        val uvH = (h + 1) / 2

        val nv21 = ByteBuffer.allocate(w * h + uvW * uvH * 2)

        // ── Y plane: baca w byte per baris, lompati padding ──
        val rowY = ByteArray(w)
        val srcY = yPlane.buffer
        srcY.rewind()
        for (y in 0 until h) {
            if (srcY.remaining() < w) break
            srcY.get(rowY)
            nv21.put(rowY)
            val skip = yRowStride - w
            if (skip > 0 && srcY.remaining() >= skip) {
                srcY.position(srcY.position() + skip)
            }
        }

        // ── Interleave V & U (NV21 = V dulu, U kedua; uvW byte per baris) ──
        val rowV = ByteArray(uvW)
        val rowU = ByteArray(uvW)
        val srcV = vPlane.buffer
        val srcU = uPlane.buffer
        srcV.rewind()
        srcU.rewind()
        for (y in 0 until uvH) {
            if (srcV.remaining() < uvW) break
            srcV.get(rowV)
            for (b in rowV) nv21.put(b)
            val skipV = vRowStride - uvW
            if (skipV > 0 && srcV.remaining() >= skipV) {
                srcV.position(srcV.position() + skipV)
            }
            if (srcU.remaining() < uvW) break
            srcU.get(rowU)
            for (b in rowU) nv21.put(b)
            val skipU = uRowStride - uvW
            if (skipU > 0 && srcU.remaining() >= skipU) {
                srcU.position(srcU.position() + skipU)
            }
        }

        nv21.rewind()
        return nv21
    }

    /**
     * Rotasi frame BGR (w*h*3, row-major BGR) searah jarum jam.
     * Digunakan untuk menyelaraskan buffer kamera sensor (landscape/orientasi sensor)
     * dengan koordinat landmark — supaya crop menangkap bibir, bukan area miring.
     *
     * [FIX ROTASI 90/270] Untuk 90/270 derajat dimensi output bertukar (h x w).
     * Index output harus memakai pitch = lebar OUTPUT (h untuk 90, w untuk 270).
     * Sebelumnya memakai pitch input (w/h), yang untuk frame non-persegi (w != h)
     * menghasilkan rotasi yang salah secara geometri dan — pada 90 derajat dengan
     * w > h — ArrayIndexOutOfBounds (frame dibuang, clip "tanpa bibir").
     *
     * @return BGR baru berukuran h*w*3 (dimensi bertukar untuk 90/270 derajat)
     */
    fun rotateBgr(src: ByteArray, w: Int, h: Int, deg: Int): ByteArray {
        if (deg % 360 == 0) return src
        val out = when (deg % 360) {
            90 -> {
                // Rotasi 90° CW: output (h x w), pitch = h.
                // Pixel (x,y) -> out(y_out = x, x_out = h-1-y) => idx = x*h + (h-1-y).
                val o = ByteArray(w * h * 3)
                for (y in 0 until h) {
                    for (x in 0 until w) {
                        val si = (y * w + x) * 3
                        val di = (x * h + (h - 1 - y)) * 3
                        o[di] = src[si]; o[di + 1] = src[si + 1]; o[di + 2] = src[si + 2]
                    }
                }
                o
            }
            180 -> {
                val o = ByteArray(w * h * 3)
                for (y in 0 until h) {
                    for (x in 0 until w) {
                        val si = (y * w + x) * 3
                        val di = ((h - 1 - y) * w + (w - 1 - x)) * 3
                        o[di] = src[si]; o[di + 1] = src[si + 1]; o[di + 2] = src[si + 2]
                    }
                }
                o
            }
            270 -> {
                // Rotasi 270° CW (= 90° CCW): output (h x w), pitch = h.
                // Pixel (x,y) -> out(y_out = w-1-x, x_out = y) => idx = (w-1-x)*h + y.
                val o = ByteArray(w * h * 3)
                for (y in 0 until h) {
                    for (x in 0 until w) {
                        val si = (y * w + x) * 3
                        val di = ((w - 1 - x) * h + y) * 3
                        o[di] = src[si]; o[di + 1] = src[si + 1]; o[di + 2] = src[si + 2]
                    }
                }
                o
            }
            else -> src
        }
        return out
    }

    /** android.media.Image (dari frame.getImage()) -> BGR byte array (w*h*3). */
    fun yuvToBgr(image: Image, w: Int, h: Int): ByteArray {
        return try {
            val planes = image.planes
            if (planes.size < 3) {
                Log.w(TAG, "Planes < 3 (${planes.size}) — return kosong")
                return ByteArray(w * h * 3)
            }

            val yPlane = planes[0]
            val uPlane = planes[1]
            val vPlane = planes[2]
            val yRowStride = yPlane.rowStride
            val uRowStride = uPlane.rowStride
            val vRowStride = vPlane.rowStride
            val uvW = (w + 1) / 2

            val srcY = yPlane.buffer
            val srcU = uPlane.buffer
            val srcV = vPlane.buffer
            srcY.rewind(); srcU.rewind(); srcV.rewind()

            val rowY = ByteArray(w)
            val rowU = ByteArray(uvW)
            val rowV = ByteArray(uvW)

            val bgr = ByteArray(w * h * 3)
            var bgrPos = 0

            for (y in 0 until h) {
                if (srcY.remaining() < w) break
                srcY.get(rowY)
                val skipY = yRowStride - w
                if (skipY > 0 && srcY.remaining() >= skipY) {
                    srcY.position(srcY.position() + skipY)
                }

                // U/V disubsample 2:1 vertikal — baca baris U/V hanya di y genap,
                // baris y ganjil memakai rowU/rowV dari pasangan sebelumnya.
                if (y % 2 == 0) {
                    if (srcU.remaining() >= uvW) {
                        srcU.get(rowU)
                        val skipU = uRowStride - uvW
                        if (skipU > 0 && srcU.remaining() >= skipU) {
                            srcU.position(srcU.position() + skipU)
                        }
                    }
                    if (srcV.remaining() >= uvW) {
                        srcV.get(rowV)
                        val skipV = vRowStride - uvW
                        if (skipV > 0 && srcV.remaining() >= skipV) {
                            srcV.position(srcV.position() + skipV)
                        }
                    }
                }

                for (x in 0 until w) {
                    val yy = rowY[x].toInt() and 0xFF
                    val u = rowU[x / 2].toInt() and 0xFF
                    val v = rowV[x / 2].toInt() and 0xFF

                    // BT.601 (persis cv2.cvtColor YUV2BGR)
                    val yyMinus16 = yy - 16
                    val uMinus128 = u - 128
                    val vMinus128 = v - 128

                    val r = (1.164f * yyMinus16 + 1.596f * vMinus128).toInt().coerceIn(0, 255)
                    val g = (1.164f * yyMinus16 - 0.813f * vMinus128 - 0.392f * uMinus128).toInt().coerceIn(0, 255)
                    val b = (1.164f * yyMinus16 + 2.017f * uMinus128).toInt().coerceIn(0, 255)

                    bgr[bgrPos++] = b.toByte()
                    bgr[bgrPos++] = g.toByte()
                    bgr[bgrPos++] = r.toByte()
                }
            }
            bgr
        } catch (e: Exception) {
            Log.e(TAG, "yuvToBgr error", e)
            ByteArray(w * h * 3)
        }
    }
}
