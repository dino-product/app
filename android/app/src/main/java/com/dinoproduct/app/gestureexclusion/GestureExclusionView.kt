package com.dinoproduct.app.gestureexclusion

import android.content.Context
import android.graphics.Rect
import android.os.Build
import android.view.View

/**
 * 레이아웃될 때마다 자기 영역 전체를 시스템 제스처 제외 영역으로 둔다 (JS `GestureExclusionArea`).
 * 자리와 크기는 JS 스타일이 정한다. 스크롤로 화면 위치가 바뀌는 것은 시스템이 따라간다.
 */
class GestureExclusionView(context: Context) : View(context) {

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    super.onLayout(changed, left, top, right, bottom)
    // 제스처 내비게이션과 이 API 는 Android 10 부터다. 그 아래에는 가장자리 뒤로 가기가 없다
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      systemGestureExclusionRects = listOf(Rect(0, 0, width, height))
    }
  }
}
