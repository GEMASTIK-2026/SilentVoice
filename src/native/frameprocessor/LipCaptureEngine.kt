package com.silentvoice.frameprocessor

import android.util.Log
import java.util.ArrayDeque

/**
 * State machine capture mulut — persis spesifikasi PART A.1:
 *
 *   IDLE -> WAITING_FOR_OPEN (ring buffer 15 frame, kalibrasi baseline MAR live,
 *          threshold = baseline_mean + MAR_K_STD * baseline_std)
 *        -> trigger (MAR > threshold beberapa frame beruntun)
 *        -> RECORDING (append frame baru + 15 frame pre-roll dari ring buffer)
 *        -> mulut tertutup stabil 15 frame beruntun ATAU timeout 8 detik
 *        -> emit clip lengkap
 *        -> KEMBALI ke WAITING_FOR_OPEN (TANPA menunggu hasil precompute/inference)
 *
 * Kalau landmark gagal terdeteksi mayoritas frame dalam 1 clip, emit "capture_failed"
 * (bukan prediksi kosong).
 */
class LipCaptureEngine(private val listener: Listener) {

    enum class State { IDLE, WAITING_FOR_OPEN, RECORDING }

    interface Listener {
        /** Clip lengkap siap diproses (frame mentah: gray align + landmark + MAR + ts). */
        fun onClipReady(clip: List<LipFrame>, sequenceId: Long)

        /** Gagal menangkap (landmark mayoritas gagal). */
        fun onCaptureFailed(sequenceId: Long, reason: String)

        /** State machine berubah: "idle" | "waiting" | "recording" (untuk status pill UI). */
        fun onStateChange(state: String)

        /** Status deteksi wajah berubah — hanya di-emit saat berubah, bukan tiap frame. */
        fun onFaceDetected(detected: Boolean)
    }

    companion object {
        private const val TAG = "LipCaptureEngine"
        private const val OPEN_TRIGGER_FRAMES = 5    // MAR > threshold 5 frame beruntun (naik dari 3)
        private const val CLOSE_STABLE_FRAMES = 20   // mulut tertutup stabil utk stop
        private const val MAX_CLIP_MS = 8000L
        private const val MAX_CLIP_FRAMES = 400      // safety net (MAX_FRAMES_READ dari CONFIG)
        // [FIX FALSE TRIGGER] Floor MAR absolut utk trigger BUKA.
        // Baseline bibir TERTUTUP punya std mendekati nol → threshold adaptif
        // (mean + 1.5σ) jatuh ke ~0.006, sehingga jitter kecil (0.01-0.12) dari
        // noise MediaPipe sanggup merekam tanpa ada mulut yang terbuka (clip_4
        // apex 0.012 & clip_5 spike 0.12 tertangkap). Buka mulut asli menghasilkan
        // MAR 0.4+ — jauh di atas noise. Floor 0.10 menolak noise namun tak
        // menghalangi bukaan sungguhan.
        private const val OPEN_MAR_FLOOR = 0.10f

        // [FIX CLIP OVERRUN] Floor MAR absolut utk STOP (simetris OPEN_MAR_FLOOR).
        // Penyebab clip meleset panjang (clip_3 = 121 frame, timeout 8s):
        //   - marRing di-update HANYA saat WAITING dan BEKU saat RECORDING, sehingga
        //     setelah trigger threshold close ter-inflasi oleh MAR onset kata
        //     (frame 13-19: 0.04-0.17) menjadi ~0.08.
        //   - Jitter gerakan kecil (kepala/bibir) frame 44-75 (MAR 0.03-0.17)
        //     terus me-reset closeStreak (17 frame > 0.08), jadi clip tak pernah
        //     berhenti di akhir kata pertama → menangkap kata kedua & timeout.
        // Floor 0.10 membuat 20 frame MAR < 0.10 menumpuk di jitter (<0.10) sehingga
        // clip berhenti tepat di akhir kata (verifikasi sim: stop di frame 49,
        // hanya kata pertama, tanpa menunggu timeout).
        private const val CLOSE_MAR_FLOOR = 0.10f
    }

    private var state = State.IDLE
    private var sessionActive = false

    // WAITING_FOR_OPEN: ring buffer MAR 15 frame terakhir (untuk baseline threshold)
    private val marRing = ArrayDeque<Float>()

    // RECORDING: buffer clip (LipFrame lengkap, termasuk 15 frame pre-roll)
    private val clipBuffer = ArrayDeque<LipFrame>()
    private val fullRing = ArrayDeque<LipFrame>()   // 15 frame penuh terakhir (pre-roll)

    private var clipStartMs = 0L
    private var clipTotalFrames = 0
    private var clipDetectedFrames = 0
    private var openStreak = 0
    private var closeStreak = 0

    private var sequenceCounter = 0L
    private var lastFaceDetected: Boolean? = null   // hanya emit saat BERUBAH

    fun startSession() {
        sessionActive = true
        state = State.WAITING_FOR_OPEN
        marRing.clear()
        fullRing.clear()
        clipBuffer.clear()
        openStreak = 0; closeStreak = 0
        lastFaceDetected = null
        Log.d(TAG, "Session dimulai. State: WAITING_FOR_OPEN")
        listener.onStateChange("waiting")
    }

    fun stopSession() {
        sessionActive = false
        state = State.IDLE
        marRing.clear()
        fullRing.clear()
        clipBuffer.clear()
        Log.d(TAG, "Session dihentikan. State: IDLE")
        listener.onStateChange("idle")
    }

    fun onFrame(frame: LipFrame) {
        if (!sessionActive || state == State.IDLE) return

        // Emit perubahan status deteksi wajah (hanya saat BERUBAH, bukan tiap frame)
        val detected = frame.landmarkDetected
        if (lastFaceDetected != detected) {
            lastFaceDetected = detected
            listener.onFaceDetected(detected)
        }

        if (!frame.landmarkDetected) {
            if (state == State.RECORDING) {
                clipTotalFrames++   // hitung utk rasio deteksi
            } else {
                // WAITING_FOR_OPEN: banyak gagal = wajah keluar frame; reset baseline
                marRing.clear()
                fullRing.clear()
            }
            return
        }

        when (state) {
            State.WAITING_FOR_OPEN -> {
                // Ring buffer MAR 15 frame + full ring 15 frame (utk pre-roll)
                marRing.addLast(frame.mar)
                if (marRing.size > LipConfig.RING_BUFFER_SIZE) marRing.removeFirst()
                fullRing.addLast(frame)
                if (fullRing.size > LipConfig.RING_BUFFER_SIZE) fullRing.removeFirst()

                if (marRing.size >= LipConfig.RING_BUFFER_SIZE) {
                    // Trigger BUKA: MAR > threshold (floor absolut anti-noise) terus
                    // menerus beberapa frame. Baseline tertutup std≈0 threshold adaptif
                    // sangat rendah → pakai max(dinamis, OPEN_MAR_FLOOR).
                    val threshold = maxOf(currentThreshold(LipConfig.MAR_K_STD_OPEN), OPEN_MAR_FLOOR)
                    if (frame.mar > threshold) {
                        openStreak++
                        if (openStreak >= OPEN_TRIGGER_FRAMES) {
                            startRecording()
                            openStreak = 0
                        }
                    } else {
                        openStreak = 0
                    }
                }
            }

            State.RECORDING -> {
                clipBuffer.addLast(frame)
                clipTotalFrames++
                clipDetectedFrames++

                // Mulut tertutup stabil — hysteresis: berhenti hanya saat MAR kembali ≤ +0.5σ baseline
                // [FIX CLIP OVERRUN] max dengan CLOSE_MAR_FLOOR agar jitter kecil (0.03-0.17)
                // tidak menunda stop tak terbatas (lihat konstanta CLOSE_MAR_FLOOR).
                val threshold = maxOf(currentThreshold(LipConfig.MAR_K_STD_CLOSE), CLOSE_MAR_FLOOR)
                if (frame.mar < threshold) {
                    closeStreak++
                    if (closeStreak >= CLOSE_STABLE_FRAMES) {
                        emitClip()
                    }
                } else {
                    closeStreak = 0
                }

                // Timeout
                if (frame.timestampMs - clipStartMs > MAX_CLIP_MS || clipTotalFrames >= MAX_CLIP_FRAMES) {
                    emitClip()
                }
            }

            State.IDLE -> {}
        }
    }

    /** baseline_mean + kStd * baseline_std dari 15 MAR terakhir — kStd = hysteresis arah (buka/tutup) */
    private fun currentThreshold(kStd: Float): Float {
        val vals = marRing.toList()
        if (vals.isEmpty()) return 0f
        val mean = vals.average().toFloat()
        val variance = vals.map { (it - mean) * (it - mean) }.average().toFloat()
        val std = kotlin.math.sqrt(variance)
        return mean + kStd * std
    }

    private fun startRecording() {
        state = State.RECORDING
        clipStartMs = System.currentTimeMillis()
        clipTotalFrames = 0
        clipDetectedFrames = 0
        clipBuffer.clear()
        // Pre-roll: 15 frame dari fullRing
        clipBuffer.addAll(fullRing)
        clipDetectedFrames += fullRing.size
        clipTotalFrames += fullRing.size
        closeStreak = 0
        Log.d(TAG, "Mulai RECORDING (pre-roll ${fullRing.size} frame)")
        listener.onStateChange("recording")
    }

    private fun emitClip() {
        val detected = clipDetectedFrames
        val total = clipTotalFrames

        if (total < 4) {
            Log.d(TAG, "Clip dibuang ($total frame < 4)")
            resetToWaiting()
            return
        }

        // Deteksi mayoritas gagal
        val ratio = detected.toFloat() / total
        val seqId = sequenceCounter++

        if (ratio < 0.5f) {
            Log.d(TAG, "Clip GAGAL (deteksi ratio $ratio < 0.5)")
            listener.onCaptureFailed(seqId, "landmark_detection_failed")
            resetToWaiting()
            return
        }

        val clip = clipBuffer.toList()
        Log.d(TAG, "Clip siap: ${clip.size} frame (ratio $ratio), seq=$seqId")
        listener.onClipReady(clip, seqId)

        // Kembali ke WAITING_FOR_OPEN tanpa menunggu hasil
        resetToWaiting()
    }

    private fun resetToWaiting() {
        state = State.WAITING_FOR_OPEN
        clipBuffer.clear()
        fullRing.clear()
        marRing.clear()
        closeStreak = 0
        openStreak = 0
        listener.onStateChange("waiting")
    }
}
