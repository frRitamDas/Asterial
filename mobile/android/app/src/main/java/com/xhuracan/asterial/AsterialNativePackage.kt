package com.xhuracan.asterial

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class AsterialNativePackage : BaseReactPackage() {

  override fun getModule(
      name: String,
      reactContext: ReactApplicationContext,
  ): NativeModule? {
    return if (name == AsterialNativeModule.NAME) {
      AsterialNativeModule(reactContext)
    } else {
      null
    }
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      mapOf(
          AsterialNativeModule.NAME to
              ReactModuleInfo(
                  AsterialNativeModule.NAME,
                  AsterialNativeModule::class.java.name,
                  false,
                  false,
                  false,
                  false,
              ),
      )
    }
  }
}
