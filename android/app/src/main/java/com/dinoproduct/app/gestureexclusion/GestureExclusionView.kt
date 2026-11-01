package com.dinoproduct.app.gestureexclusion

import android.content.Context
import android.graphics.Rect
import android.os.Build
import android.view.View
import android.view.ViewTreeObserver
import com.facebook.react.uimanager.ReactOverflowView
import com.facebook.react.uimanager.ViewProps

/**
 * 자기 영역 중 화면에 보이는 부분을 시스템 제스처 제외 영역으로 둔다 (JS `GestureExclusionArea`).
 * 자리와 크기는 JS 스타일이 정한다.
 */
class GestureExclusionView(context: Context) : View(context) {

  private val ownLocation = IntArray(2)
  private val clipLocation = IntArray(2)
  private var excluded = Rect()
  private val onScrollChanged = ViewTreeObserver.OnScrollChangedListener { updateExclusion() }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    viewTreeObserver.addOnScrollChangedListener(onScrollChanged)
    // 탭 전환·화면 push 로 떼였다 다시 붙으면 크기가 같아 onLayout 이 다시 오지 않고,
    // View 도 떼일 때 빠진 제외 영역을 스스로 다시 알리지 않는다
    updateExclusion(force = true)
  }

  override fun onDetachedFromWindow() {
    viewTreeObserver.removeOnScrollChangedListener(onScrollChanged)
    super.onDetachedFromWindow()
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    super.onLayout(changed, left, top, right, bottom)
    updateExclusion()
  }

  private fun updateExclusion(force: Boolean = false) {
    // 제스처 내비게이션과 이 API 는 Android 10 부터다. 그 아래에는 가장자리 뒤로 가기가 없다
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      return
    }
    val visible = Rect(0, 0, width, height)
    // RN 뷰·스크롤 뷰는 clipChildren=false 라 시스템이 제외 영역을 조상 경계로 잘라 주지 않는다.
    // overflow hidden·scroll 조상(리스트) 밖으로 밀려난 부분은 터치도 오지 않으니(TouchTargetHelper)
    // 그곳은 뒤로 가기로 남긴다. overflow visible 조상 밖(부모 여백)은 일부러 넓힌 곳이라 자르지 않는다
    getLocationInWindow(ownLocation)
    var ancestor = parent
    while (ancestor is View) {
      val overflow = (ancestor as? ReactOverflowView)?.overflow
      if (overflow == ViewProps.HIDDEN || overflow == ViewProps.SCROLL) {
        ancestor.getLocationInWindow(clipLocation)
        val left = clipLocation[0] - ownLocation[0]
        val top = clipLocation[1] - ownLocation[1]
        if (!visible.intersect(left, top, left + ancestor.width, top + ancestor.height)) {
          visible.setEmpty()
          break
        }
      }
      ancestor = ancestor.parent
    }
    if (!force && visible == excluded) {
      return
    }
    excluded = visible
    // 화면 위치가 바뀌는 것은 시스템이 따라간다. 여기서는 보이는 부분이 바뀔 때만 다시 둔다
    systemGestureExclusionRects = if (visible.isEmpty) emptyList() else listOf(visible)
  }
}
