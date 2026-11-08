package com.dinoproduct.app.kakaomap

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.view.MotionEvent
import android.widget.FrameLayout
import com.dinoproduct.app.R
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.WritableMap
import com.facebook.react.common.LifecycleState
import com.facebook.react.uimanager.PixelUtil
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import com.kakao.vectormap.GestureType
import com.kakao.vectormap.KakaoMap
import com.kakao.vectormap.KakaoMapReadyCallback
import com.kakao.vectormap.KakaoMapSdk
import com.kakao.vectormap.LatLng
import com.kakao.vectormap.MapAuthException
import com.kakao.vectormap.MapLifeCycleCallback
import com.kakao.vectormap.MapView
import com.kakao.vectormap.camera.CameraUpdateFactory
import com.kakao.vectormap.label.Label
import com.kakao.vectormap.label.LabelOptions
import com.kakao.vectormap.label.LabelStyle
import com.kakao.vectormap.label.LabelStyles
import kotlin.math.roundToInt

/**
 * 작업 위치 지도 (#67, JS 스펙 src/shared/native/KakaoMapViewNativeComponent.ts).
 * 좌표를 가운데에 두고 마커를 찍은 카카오맵 SDK v2 MapView 를 담는다. 움직이지 않는 표시용이라 제스처를 모두 끄고 터치도 받지 않는다.
 *
 * - SDK 초기화는 처음 지도를 그릴 때 한다 (콜드 스타트에 넣지 않는다). 앱 키는 카카오 로그인과 같은 네이티브 앱 키(리소스 kakao_app_key)
 * - 생명주기: 화면(Activity) resume/pause 에 맞춰 MapView.resume()/pause() 를 부르고, 뷰가 내려가면 finish() 로 엔진을 정리한다
 *   (부르지 않으면 크래시가 날 수 있다 — 카카오맵 SDK v2 개발 주의사항)
 */
@SuppressLint("ViewConstructor")
class KakaoMapContainer(private val reactContext: ThemedReactContext) :
    FrameLayout(reactContext), LifecycleEventListener {

  private var latitude = Double.NaN
  private var longitude = Double.NaN
  private var zoomLevel = DEFAULT_ZOOM_LEVEL

  private var mapView: MapView? = null
  private var kakaoMap: KakaoMap? = null
  private var marker: Label? = null
  private var destroyed = false

  // 지도는 SurfaceView 라 부모(RN)의 둥근 자르기가 먹지 않는다. 귀퉁이를 카드 배경색으로 덮는다
  private var cornerRadiusPx = 0f
  private var cornerMaskColor: Int? = null
  private val cornerPaint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val cornerPath = Path()

  // RN 은 자기 뷰만 배치한다. MapView 가 start() 뒤 안쪽에 SurfaceView 를 붙여도 다시 배치되지 않으므로 직접 잰다
  private val measureAndLayout = Runnable {
    measure(
        MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY))
    layout(left, top, right, bottom)
  }

  init {
    isClickable = false
    isFocusable = false
    setWillNotDraw(false)
    reactContext.addLifecycleEventListener(this)
  }

  fun setLatitude(value: Double) {
    latitude = value
  }

  fun setLongitude(value: Double) {
    longitude = value
  }

  fun setZoomLevel(value: Int) {
    zoomLevel = value
  }

  fun setCornerRadius(valueDp: Float) {
    cornerRadiusPx = PixelUtil.toPixelFromDIP(valueDp)
    invalidate()
  }

  fun setCornerMaskColor(value: Int?) {
    cornerMaskColor = value
    invalidate()
  }

  /**
   * 한 번의 props 갱신이 끝났다. 처음이면 지도를 시작하고, 이미 그렸으면 가운데·마커만 옮긴다.
   * (JS 는 좌표가 바뀌면 key 로 새 뷰를 만들지만, 같은 뷰에 새 좌표가 와도 맞게 둔다)
   */
  fun commitProps() {
    if (destroyed || latitude.isNaN() || longitude.isNaN()) {
      return
    }
    val map = kakaoMap
    if (mapView == null) {
      start()
    } else if (map != null) {
      val center = LatLng.from(latitude, longitude)
      map.moveCamera(CameraUpdateFactory.newCenterPosition(center, zoomLevel))
      marker?.moveTo(center)
    }
  }

  private fun start() {
    if (!ensureSdk(context)) {
      emitError(NO_SDK_ERROR)
      return
    }
    val view =
        try {
          MapView(context).also {
            addView(it, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
            it.start(lifeCycleCallback, readyCallback)
          }
        } catch (error: Throwable) {
          // 지도 엔진을 만들지 못하는 기기(네이티브 라이브러리가 없는 ABI 등). 화면은 회색 자리로 둔다
          removeAllViews()
          emitError(NO_SDK_ERROR)
          return
        }
    mapView = view
    // 이미 화면이 보이는 중이면 Activity onResume 이 다시 오지 않으므로 바로 resume 한다
    if (reactContext.lifecycleState == LifecycleState.RESUMED) {
      resumeMap()
    }
  }

  // 인증(키·키 해시·패키지 미등록)·네트워크·엔진 오류. 다시 시도하지 않고 회색 자리로 둔다
  private val lifeCycleCallback =
      object : MapLifeCycleCallback() {
        override fun onMapDestroy() = Unit

        override fun onMapError(error: Exception) {
          val code = (error as? MapAuthException)?.getErrorCode() ?: UNKNOWN_ERROR
          post { emitError(code) }
        }
      }

  // KakaoMapReadyCallback 은 Java 클래스라 그 안에서 zoomLevel 은 콜백 자신의 getZoomLevel() 로 풀린다.
  // 바깥 필드는 반드시 this@KakaoMapContainer 로 읽는다 (아니면 자기 자신을 불러 StackOverflowError)
  private val readyCallback =
      object : KakaoMapReadyCallback() {
        override fun getPosition(): LatLng =
            LatLng.from(this@KakaoMapContainer.latitude, this@KakaoMapContainer.longitude)

        override fun getZoomLevel(): Int = this@KakaoMapContainer.zoomLevel

        override fun onMapReady(map: KakaoMap) {
          post { onReady(map) }
        }
      }

  private fun resumeMap() {
    mapView?.let { if (!it.isResumed) it.resume() }
  }

  private fun onReady(map: KakaoMap) {
    if (destroyed) {
      return
    }
    kakaoMap = map
    // 표시용: 이동·확대·축소·회전·기울이기 제스처를 모두 끈다 (Unknown 은 제스처가 아니다)
    GestureType.values()
        .filter { it != GestureType.Unknown }
        .forEach { map.setGestureEnable(it, false) }
    val styles =
        map.labelManager?.addLabelStyles(
            LabelStyles.from(
                LabelStyle.from(markerBitmap())
                    // 핀 끝이 좌표를 가리킨다 (그림 52 중 핀 끝 y 45.5)
                    .setAnchorPoint(0.5f, MARKER_ANCHOR_Y)
                    // 그림을 52dp 로 직접 맞췄으므로 SDK 의 dp 배율을 다시 곱하지 않는다
                    .setApplyDpScale(false)))
    marker =
        map.labelManager
            ?.layer
            ?.addLabel(LabelOptions.from(LatLng.from(latitude, longitude)).setStyles(styles))
    emit("topMapReady", Arguments.createMap())
  }

  // Figma 작업 위치 마커(반투명 원 52 + 핀 48)를 내보낸 그림. drawable-nodpi 원본(4배)을 52dp 로 줄인다
  private fun markerBitmap(): Bitmap {
    val source = BitmapFactory.decodeResource(resources, R.drawable.kakao_map_marker)
    val size = (MARKER_SIZE_DP * resources.displayMetrics.density).roundToInt()
    return Bitmap.createScaledBitmap(source, size, size, true)
  }

  private fun emitError(code: Int) {
    emit("topMapError", Arguments.createMap().apply { putInt("code", code) })
  }

  private fun emit(name: String, payload: WritableMap) {
    if (destroyed) {
      return
    }
    val surfaceId = UIManagerHelper.getSurfaceId(reactContext)
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)
        ?.dispatchEvent(MapEvent(surfaceId, id, name, payload))
  }

  // 지도는 끌거나 누를 수 없다. 터치를 지도로 내려보내지 않고 받지도 않아 부모(스크롤·누르기)가 처리한다
  override fun onInterceptTouchEvent(event: MotionEvent): Boolean = true

  @SuppressLint("ClickableViewAccessibility")
  override fun onTouchEvent(event: MotionEvent): Boolean = false

  override fun requestLayout() {
    super.requestLayout()
    post(measureAndLayout)
  }

  override fun dispatchDraw(canvas: Canvas) {
    super.dispatchDraw(canvas)
    val color = cornerMaskColor ?: return
    if (cornerRadiusPx <= 0f || width == 0 || height == 0) {
      return
    }
    val w = width.toFloat()
    val h = height.toFloat()
    cornerPath.reset()
    cornerPath.fillType = Path.FillType.EVEN_ODD
    cornerPath.addRect(0f, 0f, w, h, Path.Direction.CW)
    cornerPath.addRoundRect(0f, 0f, w, h, cornerRadiusPx, cornerRadiusPx, Path.Direction.CW)
    cornerPaint.color = color
    canvas.drawPath(cornerPath, cornerPaint)
  }

  override fun onHostResume() {
    resumeMap()
  }

  override fun onHostPause() {
    mapView?.pause()
  }

  override fun onHostDestroy() {
    destroy()
  }

  /** 뷰가 내려간다. 엔진을 끝내고 생명주기 구독을 푼다 (상세를 들락날락해도 메모리가 쌓이지 않게) */
  fun destroy() {
    if (destroyed) {
      return
    }
    destroyed = true
    reactContext.removeLifecycleEventListener(this)
    removeCallbacks(measureAndLayout)
    marker = null
    kakaoMap = null
    mapView?.let {
      it.pause()
      it.finish()
      removeView(it)
    }
    mapView = null
  }

  private class MapEvent(
      surfaceId: Int,
      viewId: Int,
      private val name: String,
      private val payload: WritableMap,
  ) : Event<MapEvent>(surfaceId, viewId) {
    override fun getEventName(): String = name

    override fun getEventData(): WritableMap = payload
  }

  companion object {
    private const val DEFAULT_ZOOM_LEVEL = 16
    private const val MARKER_SIZE_DP = 52f
    private const val MARKER_ANCHOR_Y = 45.5f / 52f
    /** 앱 키가 없거나 SDK 를 켜지 못했다 (지원하지 않는 ABI 등) */
    private const val NO_SDK_ERROR = -2
    private const val UNKNOWN_ERROR = -1

    /** 앱 키로 SDK 를 한 번 켠다. 키가 비었으면(키 없이 만든 CI·로컬 빌드) 켜지 않는다 */
    private fun ensureSdk(context: Context): Boolean {
      if (KakaoMapSdk.isInitialized()) {
        return true
      }
      val appKey = context.getString(R.string.kakao_app_key).trim()
      if (appKey.isEmpty()) {
        return false
      }
      return try {
        KakaoMapSdk.init(context.applicationContext, appKey)
        true
      } catch (error: Throwable) {
        // 네이티브 라이브러리(armeabi-v7a·arm64-v8a 만 있다)를 못 읽는 기기 등
        false
      }
    }
  }
}
