package com.dinoproduct.app

import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory

class MainActivity : ReactActivity() {

  /**
   * react-native-screens: Activity 가 다시 만들어질 때 화면 Fragment 복원으로 생기는 크래시를 막는다.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()
    super.onCreate(savedInstanceState)
    requestOrientationFor(resources.configuration)
  }

  /**
   * configChanges 때문에 회전·폴더블 접고 펴기·창 크기 변경에도 Activity 를 다시 만들지 않는다. 그래서 여기서 방향을 다시 정한다.
   */
  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    requestOrientationFor(newConfig)
  }

  /**
   * 휴대폰은 세로로 고정하고, 큰 화면(가장 짧은 변 600dp 이상: 태블릿, 펼친 폴더블)은 고정하지 않는다 (#56).
   * 매니페스트에 portrait 를 두면 Android 15 이하 태블릿도 세로에 묶이므로 런타임에 정한다.
   * https://developer.android.com/develop/adaptive-apps/cookbook/orientation-restriction
   *
   * 쿡북은 screenWidthDp·screenHeightDp 로 고르지만, 이 값은 회전하면 바뀌고 Android 14 이하에서는 시스템 바를 빼고 잰다.
   * 그래서 짧은 변이 600dp 를 조금 넘는 기기는 가로로 돌리면 600 아래로 내려가 세로 고정과 해제를 오갈 수 있다.
   * 회전해도 그대로인 smallestScreenWidthDp 로 본다. Android 16 이 방향 고정을 무시하는 큰 화면 기준(sw600dp)과 같다.
   * 분할 화면에서는 시스템이 방향 요청을 무시한다.
   */
  private fun requestOrientationFor(config: Configuration) {
    requestedOrientation =
        if (config.smallestScreenWidthDp < LARGE_SCREEN_MIN_DP) {
          ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        } else {
          // 매니페스트에 방향을 두지 않았을 때의 기본값
          ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "DinoApp"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  private companion object {
    /** Material 3 창 크기 클래스의 Compact 상한 (dp) */
    const val LARGE_SCREEN_MIN_DP = 600
  }
}
