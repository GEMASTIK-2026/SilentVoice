package com.silentvoice.frameprocessor

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * ReactPackage untuk mendaftarkan LipPipelineModule (startSession/stopSession)
 * ke React Native. Didaftarkan di MainApplication.kt oleh config plugin
 * plugins/withLipPipeline.js saat prebuild.
 */
class LipPipelinePackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(LipPipelineModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
