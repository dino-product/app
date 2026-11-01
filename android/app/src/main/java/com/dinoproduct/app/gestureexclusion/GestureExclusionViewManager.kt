package com.dinoproduct.app.gestureexclusion

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.GestureExclusionViewManagerDelegate
import com.facebook.react.viewmanagers.GestureExclusionViewManagerInterface

/** codegen 스펙: src/shared/native/GestureExclusionViewNativeComponent.ts */
@ReactModule(name = GestureExclusionViewManager.NAME)
class GestureExclusionViewManager :
    SimpleViewManager<GestureExclusionView>(),
    GestureExclusionViewManagerInterface<GestureExclusionView> {

  private val delegate =
      GestureExclusionViewManagerDelegate<GestureExclusionView, GestureExclusionViewManager>(this)

  override fun getDelegate(): ViewManagerDelegate<GestureExclusionView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): GestureExclusionView =
      GestureExclusionView(context)

  companion object {
    const val NAME = "GestureExclusionView"
  }
}
