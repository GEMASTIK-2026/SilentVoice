package com.silentvoice.frameprocessor

import android.util.Log
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry
import com.mrousavy.camera.frameprocessors.VisionCameraProxy

/**
 * Frame Processor Plugin — API persis VisionCamera 4.7.0 (terverifikasi dari
 * source node_modules: FrameProcessorPlugin.java + FrameProcessorPluginRegistry.java).
 *
 * Registrasi: FrameProcessorPluginRegistry.addFrameProcessorPlugin(name) { proxy, options ->
 *     LipFrameProcessorPlugin()
 * } — via PluginInitializer (factory), dipanggil di static init.
 *
 * Setiap frame kamera diteruskan ke LipPipelineRunner (singleton)
 * yang menjalankan MediaPipe + pipeline + state machine.
 */
class LipFrameProcessorPlugin : FrameProcessorPlugin() {

    override fun callback(frame: Frame, params: Map<String, Any>?): Any? {
        // JANGAN panggil frame.close() — VisionCamera yang mengelola refCount.
        LipPipelineRunner.instance?.onFrame(frame, params)
        return null
    }

    companion object {
        const val NAME = "lipFrameProcessor"

        // Blok init companion otomatis dijalankan saat class dimuat —
        // registrasi plugin berjalan di sini. @JvmStatic TIDAK valid di blok init.
        init {
            FrameProcessorPluginRegistry.addFrameProcessorPlugin(NAME) { proxy, options ->
                Log.d("LipFrameProcessor", "Plugin '$NAME' diinisialisasi (proxy=$proxy, options=$options)")
                LipFrameProcessorPlugin()
            }
            Log.i("LipFrameProcessor", "Plugin '$NAME' terdaftar di registry")
        }
    }
}
