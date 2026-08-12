package com.silentvoice.frameprocessor

import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import android.graphics.Bitmap
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.OutputHandler
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.core.types.Orientation
import java.nio.ByteBuffer
import kotlin.concurrent.thread

/**
 * Runner pipeline yang mengorkestrasi:
 *  1. MediaPipe Face Landmarker (native SDK, RunningMode.IMAGE, sync detect)
 *  2. LipPipeline.process() per frame
 *  3. LipCaptureEngine (state machine + ring buffer)
 *  4. LipPrecompute.precomputeClip() saat clip siap
 *  5. Kirim event ke JS via RCTDeviceEventEmitter
 *
 * Singleton — diinisialisasi saat JS memanggil startSession().
 * API terverifikasi dari tasks-vision 0.10.21 (javap):
 *   FaceLandmarker.createFromOptions(Context, Options)
 *   lm.detect(MPImage)  ->  FaceLandmarkerResult
 *   result.faceLandmarks()  ->  List<List<NormalizedLandmark>>
 *   NormalizedLandmark.x()/.y()  (float ternormalisasi 0..1)
 */
class LipPipelineRunner(private val reactContext: ReactApplicationContext) {

    companion object {
        private const val TAG = "LipPipelineRunner"
        const val EVENT_CLIP_READY = "onClipReady"
        const val EVENT_CAPTURE_FAILED = "onCaptureFailed"
        const val EVENT_STATE_CHANGE = "onCaptureState"
        const val EVENT_FACE_DETECTED = "onFaceDetected"
        private const val FRAME_SNAPSHOT_MAX = 4

        @Volatile
        var instance: LipPipelineRunner? = null
            private set
    }

    private val captureEngine = LipCaptureEngine(object : LipCaptureEngine.Listener {
        override fun onClipReady(clip: List<LipFrame>, sequenceId: Long) {
            handleClipReady(clip, sequenceId)
        }

        override fun onCaptureFailed(sequenceId: Long, reason: String) {
            sendEvent(EVENT_CAPTURE_FAILED, Arguments.createMap().also {
                it.putDouble("sequence_id", sequenceId.toDouble())
                it.putString("reason", reason)
            })
        }

        override fun onStateChange(state: String) {
            sendEvent(EVENT_STATE_CHANGE, Arguments.createMap().also {
                it.putString("state", state)
            })
        }

        override fun onFaceDetected(detected: Boolean) {
            sendEvent(EVENT_FACE_DETECTED, Arguments.createMap().also {
                it.putBoolean("detected", detected)
            })
        }
    })

    private var faceLandmarker: FaceLandmarker? = null

    init {
        instance = this
        // [DEBUG INSTANCE] Identitas instance — untuk deteksi duplikasi runner
        // (kalau 2 instance hidup, plugin memakai yang salah / tanpa log baru).
        Log.d(TAG, "RUNNER init instance=$this hash=${System.identityHashCode(this)}")
        initLandmarker()
        // PAKSA load class LipFrameProcessorPlugin agar companion init-nya
        // (registrasi frame processor ke registry VisionCamera) benar-benar berjalan.
        // PENTING: JANGAN referensikan LipFrameProcessorPlugin.NAME — NAME adalah
        // const val yang di-INLINE compiler saat kompilasi, jadi mereferensikannya
        // TIDAK memuat class (bukti: logcat "plugin does not exist!" setiap frame).
        // Class.forName PASTI memicu inisialisasi class → companion init berjalan
        // → plugin terdaftar → frame mulai mengalir ke pipeline.
        try {
            Class.forName("com.silentvoice.frameprocessor.LipFrameProcessorPlugin")
            Log.d(TAG, "LipFrameProcessorPlugin forced loaded (Class.forName)")
        } catch (e: Exception) {
            Log.e(TAG, "Gagal load LipFrameProcessorPlugin: ${e.message}")
        }
    }

    /** Inisialisasi MediaPipe Face Landmarker (model dari assets). */
    private fun initLandmarker() {
        try {
            // FaceLandmarkerOptions adalah INNER class (bukan top-level):
            // FaceLandmarker.FaceLandmarkerOptions — terverifikasi via javap.
            val resultListener = OutputHandler.ResultListener<FaceLandmarkerResult, MPImage> { result, inputImage ->
                // LIVE_STREAM: dipanggil di thread internal MediaPipe (tidak blokir kamera)
                onFaceResult(result)
            }
            val options = FaceLandmarker.FaceLandmarkerOptions.builder()
                .setBaseOptions(
                    BaseOptions.builder()
                        .setModelAssetPath("face_landmarker.task")
                        .build()
                )
                .setRunningMode(RunningMode.LIVE_STREAM)
                .setNumFaces(1)
                .setMinFaceDetectionConfidence(0.3f)
                .setMinTrackingConfidence(0.3f)
                .setResultListener(resultListener)
                .build()
            faceLandmarker = FaceLandmarker.createFromOptions(reactContext, options)
            Log.d(TAG, "MediaPipe Face Landmarker siap")
        } catch (e: Exception) {
            Log.e(TAG, "Gagal init MediaPipe: ${e.message}")
        }
    }

    fun startSession() {
        captureEngine.startSession()
        Log.d(TAG, "Session dimulai")
    }

    fun stopSession() {
        captureEngine.stopSession()
        Log.d(TAG, "Session dihentikan")
    }

    fun shutdown() {
        captureEngine.stopSession()
        faceLandmarker?.close()
        faceLandmarker = null
        instance = null
    }

    /** Dipanggil dari plugin setiap frame kamera — RINGAN, tidak memblokir. */
    fun onFrame(frame: Frame, params: Map<String, Any>?) {
        try {
            val image = frame.getImage()
            val width = frame.getWidth()
            val height = frame.getHeight()
            val ts = frame.getTimestamp()
            // [DEBUG INSTANCE] Frame masuk ke instance mana? (bandingkan dgn hash init)
            Log.d(TAG, "RUNNER onFrame instance=$this hash=${System.identityHashCode(this)}")
            lastOrientationDeg = orientationDeg(frame.getOrientation())

            // [DEBUG] Log dimensi buffer kamera + orientasi sekali per detik.
            // Bukti diagnosis "clip jidat + terbalik": apakah buffer YUV masih dalam
            // orientasi SENSOR (miring 90°/terbalik) padahal preview di UI tampak normal
            // (vision-camera me-rotasi tampilan). Kalau ya, landmark+BGR konsisten satu
            // sama lain tapi tidak sejajar dengan layar -> crop "benar matematis" namun
            // menunjuk wilayah yang salah secara fisik.
            val nowMs = System.currentTimeMillis()
            if (nowMs - lastDimLogMs > 1000L) {
                lastDimLogMs = nowMs
                try {
                    val p0 = image.planes[0]
                    Log.d(TAG, "DIM w=$width h=$height orient=${orientationDeg(frame.getOrientation())} " +
                            "yRow=${p0.rowStride} " +
                            "uRow=${image.planes[1].rowStride} " +
                            "vRow=${image.planes[2].rowStride}")
                } catch (e: Exception) {
                    Log.d(TAG, "DIM w=$width h=$height orient=${orientationDeg(frame.getOrientation())} " +
                            "(planes tak terakses: ${e.message})")
                }
            }

            val lm = faceLandmarker
            if (lm == null) {
                captureEngine.onFrame(emptyLipFrame(ts))
                return
            }

            // LIVE_STREAM: konversi ringan YUV->Bitmap ARGB_8888 (di-downscale 2x utk
            // performa; landmark MediaPipe ternormalisasi 0..1), lalu detectAsync —
            // MediaPipe proses di thread internal, frame tidak diblokir.
            //
            // FIX ORIENTASI (bukti: gambar miring 90° vs landmark):
            // Buffer kamera sensor (640x480, orient=270) belum sejajar dengan koordinat
            // landmark. Rotasikan BGR + bitmap BERSAMA-SAMA ke orientasi konsisten,
            // supaya crop menangkap bibir sesuai landmark (bukan area miring).
            val orient = lastOrientationDeg % 360
            val needRotate = (orient == 90 || orient == 270)
            val bgrRaw = FrameUtils.yuvToBgr(image, width, height)
            val rotW: Int; val rotH: Int; val bgr: ByteArray
            if (needRotate) {
                bgr = FrameUtils.rotateBgr(bgrRaw, width, height, orient)
                rotW = height; rotH = width
            } else {
                bgr = bgrRaw
                rotW = width; rotH = height
            }
            lastBgrBytes = bgr

            val halfW = rotW / 2
            val halfH = rotH / 2
            val argb = IntArray(halfW * halfH)
            for (y in 0 until halfH) {
                for (x in 0 until halfW) {
                    val srcIdx = (y * 2 * rotW + x * 2) * 3
                    val b = bgr[srcIdx].toInt() and 0xFF
                    val g = bgr[srcIdx + 1].toInt() and 0xFF
                    val r = bgr[srcIdx + 2].toInt() and 0xFF
                    argb[y * halfW + x] = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
                }
            }
            val bitmap = Bitmap.createBitmap(argb, halfW, halfH, Bitmap.Config.ARGB_8888)
            val mpImage = BitmapImageBuilder(bitmap).build()

            // Simpan ukuran FRAME ASLI (setelah rotasi) — dipakai onFaceResult utk
            // mengembalikan koordinat landmark (ternormalisasi ke bitmap HALF) ke skala
            // frame asli yang SUDAH sejajar dgn BGR.
            lastFrameWidth = rotW
            lastFrameHeight = rotH
            lastBgrTs = ts
            // [DEBUG RACE] Log ts frame yang menulis BGR — dibandingkan dgn ts result.
            Log.d(TAG, "BGR ts=$ts w=$rotW h=$rotH orient=$orient rotated=$needRotate")

            // [FIX RACE] Simpan snapshot per-frame (BGR + ukuran + orientasi) ke
            // antrian FIFO — urutannya sama dengan urutan frame dikirim ke MediaPipe,
            // dan LIVE_STREAM selalu menanggil listener untuk tiap input yang keluar.
            // onFaceResult memakai poll() sehingga landmark & BGR PASTI dari frame
            // yang sama, DAN tiap snapshot pasti dikonsumsi (tidak menumpuk).
            //
            // FIX OOM: sebelumnya pakai ConcurrentHashMap + lookup by timestamp,
            // tapi result.timestampMs() dari MediaPipe tidak pernah sama dengan
            // ts frame vision-camera (beda satuan) sehingga remove() selalu null →
            // 921KB/frame menumpuk sampai heap 256MB habis (OutOfMemoryError saat
            // rekaman). Queue FIFO menghilangkan kedua masalah itu.
            frameSnapshots.offer(FrameSnapshot(rotW, rotH, bgr, orient))
            // Guard: kalau pendeteksi tidak sempat konsumsi (sibuk/dibuang), buang
            // snapshot tertua supaya memori tetap konstan (max ~4 frame).
            while (frameSnapshots.size > FRAME_SNAPSHOT_MAX) {
                frameSnapshots.poll()
            }

            lm.detectAsync(mpImage, ts)
        } catch (exc: Exception) {
            Log.e(TAG, "onFrame error", exc)
        }
    }

    // Per-frame snapshot agar landmark & BGR berasal dari frame yang sama
    // (anti race: LIVE_STREAM MediaPipe menempel ke frame terakhir, bukan
    // frame yang BGR-nya tertimpa frame berikutnya).
    // FIFO queue, bukan map: hasil result datang berurutan ⇒ poll() memberi
    // snapshot yang cocok; dan tak ada entri yang mengendap tanpa penghapus.
    private val frameSnapshots =
        java.util.concurrent.ConcurrentLinkedQueue<FrameSnapshot>()
    private class FrameSnapshot(val w: Int, val h: Int, val bgr: ByteArray, val orientDeg: Int)

    private var lastFrameWidth = 1
    private var lastFrameHeight = 1
    private var lastBgrBytes: ByteArray = ByteArray(0)
    private var lastBgrTs = 0L                 // ts frame terakhir yang menulis lastBgrBytes
    private var lastOrientationDeg: Int = 0   // derajat rotasi sensor (dikonversi dari enum)
    private var lastDimLogMs = 0L             // throttle log dimensi: sekali per detik
    // [DEBUG] Landmark MENTAH (x,y piksel frame asli) dari frame terakhir — untuk
    // verifikasi overlay "landmark vs bibir" di PC. Format: 84 float = 42 titik × 2
    // (40 bibir + lEye + rEye). Diisi di onFaceResult; dibaca oleh DebugClipSaver.
    private var lastRawLandmarks: FloatArray = FloatArray(0)

    /** Callback LIVE_STREAM (thread MediaPipe internal) — proses landmark & kirim ke engine. */
    private fun onFaceResult(result: FaceLandmarkerResult) {
        try {
            val ts = System.currentTimeMillis()
            val faces = result.faceLandmarks()
            // [DEBUG] Callback dipanggil? Berapa face? Instance mana?
            Log.d(TAG, "RES_RAW faces=${faces.size} instance=$this hash=${System.identityHashCode(this)}")
            if (faces.isEmpty()) {
                captureEngine.onFrame(emptyLipFrame(ts))
                return
            }

            val lms = faces[0]
            // Landmark ternormalisasi 0..1 terhadap bitmap HALF — kembali ke skala frame
            // asli dengan mengalikan ukuran ASLI (width/height), bukan TARGET_SIZE crop.
            //
            // [FIX RACE] Ambil snapshot FIFO yang paling tua (frame berikutnya yang
            // dihasilkan MediaPipe). Anti-leak: poll() SELALU mengkonsumsi satu entri,
            // tidak ada mekanisme remove-by-timestamp yang bisa meleset.
            val snap = frameSnapshots.poll()
            val width: Int
            val height: Int
            val bgr: ByteArray
            if (snap != null) {
                width = snap.w
                height = snap.h
                bgr = snap.bgr
            } else {
                width = lastFrameWidth
                height = lastFrameHeight
                bgr = lastBgrBytes
            }

            // 40 titik bibir via LIPS_IDX (MediaPipe normalized 0..1 -> piksel)
            val lipGlobal = Array(LipConfig.LIPS_IDX.size) { FloatArray(2) }
            for (i in LipConfig.LIPS_IDX.indices) {
                val idx = LipConfig.LIPS_IDX[i]
                val p = lms[idx]
                lipGlobal[i][0] = p.x() * width
                lipGlobal[i][1] = p.y() * height
            }

            // Mata untuk normalisasi (outer corner)
            val lEye = floatArrayOf(
                lms[LipConfig.LEFT_EYE_OUTER].x() * width,
                lms[LipConfig.LEFT_EYE_OUTER].y() * height
            )
            val rEye = floatArrayOf(
                lms[LipConfig.RIGHT_EYE_OUTER].x() * width,
                lms[LipConfig.RIGHT_EYE_OUTER].y() * height
            )

            val lipFrame = LipPipeline.process(lipGlobal, lEye, rEye, bgr, width, height, ts)
            captureEngine.onFrame(lipFrame ?: emptyLipFrame(ts))

            // [DEBUG RACE] Bandingkan ts result vs ts BGR terakhir — delta != 0 = BUKTI
            // race: landmark dari frame A, gambar yang di-crop dari frame B (BGR tertimpa).
            val resTs = result.timestampMs()
            Log.d(TAG, "RES ts=$resTs bgrTs=$lastBgrTs delta=${resTs - lastBgrTs}")

            // [DEBUG] Simpan landmark MENTAH frame ini (koordinat piksel asli)
            // untuk verifikasi overlay di PC — BUKAN bagian dari pipeline.
            if (lipFrame != null) {
                val raw = FloatArray(84) // 42 titik × 2 (40 bibir + 2 mata)
                for (i in LipConfig.LIPS_IDX.indices) {
                    raw[i * 2] = lipGlobal[i][0]
                    raw[i * 2 + 1] = lipGlobal[i][1]
                }
                raw[80] = lEye[0]; raw[81] = lEye[1]
                raw[82] = rEye[0]; raw[83] = rEye[1]
                lastRawLandmarks = raw
            }

        } catch (exc: Exception) {
            // Silently continue — jangan blokir stream utk frame korup sesekali.
            // Log STACK TRACE LENGKAP (bukan cuma exc.message yang bisa null) —
            // ini mengungkap baris persis penyebab error "onFrame error: null" di logcat.
            Log.e(TAG, "onFrame error", exc)
        }
    }

    /** Enum orientasi kamera vision-camera → derajat rotasi; null → 0 (utk log diagnosa). */
    private fun orientationDeg(o: Orientation?): Int = when (o) {
        Orientation.PORTRAIT -> 0
        Orientation.LANDSCAPE_RIGHT -> 90
        Orientation.PORTRAIT_UPSIDE_DOWN -> 180
        Orientation.LANDSCAPE_LEFT -> 270
        null -> 0
    }

    private fun emptyLipFrame(ts: Long) = LipFrame(
        FloatArray(LipFrame.GRAY_SIZE),
        FloatArray(80),
        FloatArray(80),
        0f,
        ts,
        false
    )

    /** Handle clip siap diproses → precompute di bg thread → emit ke JS. */
    private fun handleClipReady(clip: List<LipFrame>, seqId: Long) {
        thread(priority = 4) {
            try {
                val (vis, lm) = LipPrecompute.precomputeClip(clip)

                // DEBUG BUILD ONLY: simpan clip + frame BGR MENTAH utk inspeksi (no-op di release)
                DebugClipSaver.save(reactContext, seqId, clip,
                    lastBgrBytes, lastFrameWidth, lastFrameHeight, lastOrientationDeg, lastRawLandmarks)

                if (vis.isEmpty() || lm.isEmpty()) {
                    sendEvent(EVENT_CAPTURE_FAILED, Arguments.createMap().also {
                        it.putDouble("sequence_id", seqId.toDouble())
                        it.putString("reason", "precompute_failed")
                    })
                    return@thread
                }

                val payload = Arguments.createMap()
                payload.putDouble("sequence_id", seqId.toDouble())
                payload.putString("visual_base64", floatArrayToBase64(vis))
                payload.putString("landmark_base64", floatArrayToBase64(lm))
                payload.putInt("visual_shape_0", 1)   // batch
                payload.putInt("visual_shape_1", 2)   // channel
                payload.putInt("visual_shape_2", 30)  // T
                payload.putInt("visual_shape_3", 20)  // K
                payload.putInt("visual_shape_4", 10)  // H
                payload.putInt("visual_shape_5", 10)  // W
                payload.putInt("landmark_shape_0", 30) // T
                payload.putInt("landmark_shape_1", 161) // dims

                sendEvent(EVENT_CLIP_READY, payload)
            } catch (e: Exception) {
                Log.e(TAG, "precompute error: ${e.message}")
                sendEvent(EVENT_CAPTURE_FAILED, Arguments.createMap().also {
                    it.putDouble("sequence_id", seqId.toDouble())
                    it.putString("reason", "precompute_error: ${e.message}")
                })
            }
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.e(TAG, "Gagal kirim event $eventName: ${e.message}")
        }
    }

    private fun floatArrayToBase64(arr: FloatArray): String {
        val bytes = ByteBuffer.allocate(arr.size * 4)
        val buf = bytes.asFloatBuffer()
        buf.put(arr)
        return Base64.encodeToString(bytes.array(), Base64.NO_WRAP)
    }
}
