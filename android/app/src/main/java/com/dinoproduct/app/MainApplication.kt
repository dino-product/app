package com.dinoproduct.app

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate
import com.dinoproduct.app.gestureexclusion.GestureExclusionPackage
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
          add(GestureExclusionPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // 다크 모드 미지원(#20). 첫 Activity 전에 정해야 RN 이 보는 uiMode(내비게이션 바, Appearance)도 라이트다.
    AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO)
    loadReactNative(this)
  }
}
