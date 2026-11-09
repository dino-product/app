package com.dinoproduct.app.kakaomap

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class KakaoMapPackage : ReactPackage {
  override fun createViewManagers(
      reactContext: ReactApplicationContext,
  ): List<ViewManager<in Nothing, in Nothing>> = listOf(KakaoMapViewManager())
}
