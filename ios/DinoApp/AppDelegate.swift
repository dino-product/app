import FirebaseCore
import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  // 창은 SceneDelegate 가 갖는다. 이 값은 늘 nil 이다.
  // RNFB messaging(26.4.1)이 켜질 때 delegate.window 를 확인 없이 읽어, 선언이 없으면 unrecognized selector 로 죽는다 (#118)
  var window: UIWindow?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // 푸시 (#118). Firebase 설정 파일(GoogleService-Info.plist)은 저장소에 넣지 않고, 빌드 단계가 있을 때만 번들에 넣는다.
    // 없는 빌드(CI 등)는 Firebase 를 켜지 않는다. JS 는 기본 앱이 없는 것을 보고 푸시만 끈다
    if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
      FirebaseApp.configure()
    }
    return true
  }
}
