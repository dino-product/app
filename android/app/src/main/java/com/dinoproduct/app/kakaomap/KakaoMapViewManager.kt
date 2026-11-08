package com.dinoproduct.app.kakaomap

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.KakaoMapViewManagerDelegate
import com.facebook.react.viewmanagers.KakaoMapViewManagerInterface

/** codegen 스펙: src/shared/native/KakaoMapViewNativeComponent.ts (#67) */
@ReactModule(name = KakaoMapViewManager.NAME)
class KakaoMapViewManager :
    SimpleViewManager<KakaoMapContainer>(), KakaoMapViewManagerInterface<KakaoMapContainer> {

  private val delegate =
      KakaoMapViewManagerDelegate<KakaoMapContainer, KakaoMapViewManager>(this)

  override fun getDelegate(): ViewManagerDelegate<KakaoMapContainer> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): KakaoMapContainer =
      KakaoMapContainer(context)

  override fun setLatitude(view: KakaoMapContainer, value: Double) = view.setLatitude(value)

  override fun setLongitude(view: KakaoMapContainer, value: Double) = view.setLongitude(value)

  override fun setZoomLevel(view: KakaoMapContainer, value: Int) = view.setZoomLevel(value)

  override fun setCornerRadius(view: KakaoMapContainer, value: Float) =
      view.setCornerRadius(value)

  override fun setCornerMaskColor(view: KakaoMapContainer, value: Int?) =
      view.setCornerMaskColor(value)

  // 좌표·줌이 한 번에 다 들어온 뒤 지도를 시작한다 (시작 위치를 KakaoMapReadyCallback 이 읽는다)
  override fun onAfterUpdateTransaction(view: KakaoMapContainer) {
    super.onAfterUpdateTransaction(view)
    view.commitProps()
  }

  override fun onDropViewInstance(view: KakaoMapContainer) {
    view.destroy()
    super.onDropViewInstance(view)
  }

  // JS 이벤트 이름 (스펙의 onMapReady·onMapError)
  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
      mapOf(
          "topMapReady" to mapOf("registrationName" to "onMapReady"),
          "topMapError" to mapOf("registrationName" to "onMapError"),
      )

  companion object {
    const val NAME = "KakaoMapView"
  }
}
