package com.silentvoice.frameprocessor

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Native module yang diekspos ke JS:
 *   NativeModules.LipPipelineRunner.startSession()
 *   NativeModules.LipPipelineRunner.stopSession()
 *
 * Dipakai oleh useCaptureEngine.ts (PART A.4).
 */
class LipPipelineModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    private val runner = LipPipelineRunner(reactContext)

    override fun getName(): String = "LipPipelineRunner"

    @ReactMethod
    fun startSession() {
        runner.startSession()
    }

    @ReactMethod
    fun stopSession() {
        runner.stopSession()
    }

    @ReactMethod
    fun shutdown() {
        runner.shutdown()
    }
}
