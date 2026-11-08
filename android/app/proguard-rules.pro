# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# 카카오맵 SDK v2 (#67). 코드 줄이기를 켜면 필요하다 (apis.map.kakao.com/android_v2 › 지도 시작하기)
-keep class com.kakao.vectormap.** { *; }
-keep interface com.kakao.vectormap.**
