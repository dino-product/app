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
  private val visible = Rect()
  private var excluded = Rect()
  // 스크롤이나 자기·조상의 레이아웃이 바뀌면 창을 다시 그리므로, 그리기 직전에 보이는 부분을 다시 잰다
  private val onPreDraw =
      ViewTreeObserver.OnPreDrawListener {
        updateExclusion()
        true
      }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    // 제스처 내비게이션과 이 API 는 Android 10 부터다. 그 아래에는 가장자리 뒤로 가기가 없다
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      viewTreeObserver.addOnPreDrawListener(onPreDraw)
      // 탭 전환·화면 push 로 떼였다 다시 붙을 때 시스템이 예전 영역을 다시 받는다는 보장이 없어 늘 다시 둔다
      updateExclusion(force = true)
    }
  }

  override fun onDetachedFromWindow() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      viewTreeObserver.removeOnPreDrawListener(onPreDraw)
    }
    super.onDetachedFromWindow()
  }

  private fun updateExclusion(force: Boolean = false) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      return
    }
    visible.set(0, 0, width, height)
    // RN 뷰·스크롤 뷰는 clipChildren=false 라 시스템이 제외 영역을 조상 경계로 잘라 주지 않는다.
    // overflow hidden·scroll 조상(리스트) 밖으로 밀려난 부분은 터치도 오지 않으니(TouchTargetHelper)
    // 그곳은 뒤로 가기로 남긴다. overflow visible 조상 밖(부모 여백)은 일부러 넓힌 곳이라 자르지 않는다
    getLocationInWindow(ownLocation)
    var ancestor = parent
    while (ancestor is View) {
      val overflow = (ancestor as? ReactOverflowView)?.overflow
      if (overflow == ViewProps.HIDDEN || overflow == ViewProps.SCROLL) {
        ancestor.getLocationInWindow(clipLocation)
        val clipLeft = clipLocation[0] - ownLocation[0]
        val clipTop = clipLocation[1] - ownLocation[1]
        val clipRight = clipLeft + ancestor.width
        val clipBottom = clipTop + ancestor.height
        if (!visible.intersect(clipLeft, clipTop, clipRight, clipBottom)) {
          visible.setEmpty()
          break
        }
      }
      ancestor = ancestor.parent
    }
    if (!force && visible == excluded) {
      return
    }
    // 시스템은 넘긴 Rect 를 복사하지 않고 들고 있으므로 재는 데 쓰는 Rect 와 따로 둔다
    excluded = Rect(visible)
    // 화면 위치만 바뀌는 것은 시스템이 따라간다. 여기서는 보이는 부분이 바뀔 때만 다시 둔다
    systemGestureExclusionRects = if (excluded.isEmpty) emptyList() else listOf(excluded)
  }
}
