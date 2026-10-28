package com.xhuracan.asterial

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * Native ReactActivity hosting ASTERIAL's React Native UI (no WebView wrapper).
 */
class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // Prevent fragment state restoration mismatches on configuration/process restarts
    super.onCreate(null)
  }

  override fun getMainComponentName(): String = "AsterialMobile"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
