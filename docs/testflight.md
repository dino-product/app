# TestFlight 업로드 (iOS)

Xcode 에서 직접 Archive 해서 올린다.

| 항목         | 값                                                                      |
| ------------ | ----------------------------------------------------------------------- |
| 홈 화면 이름 | Orbit (`Info.plist` `CFBundleDisplayName`)                              |
| 번들 ID      | `com.dinoproduct.app` — App Store Connect 에 등록한 뒤에는 바꿀 수 없다 |
| 팀           | `B8Q8XMT6LP`, 자동 서명                                                 |
| Xcode 스킴   | `DinoApp` (Archive 는 Release 구성)                                     |

## 처음 한 번: App Store Connect 에 앱 만들기

App Store Connect › 앱 › ＋ › 신규 앱

- **플랫폼:** iOS
- **이름:** Orbit
  - 다른 앱이 이미 쓰는 이름이면 등록되지 않는다. 그때는 뒤에 부제를 붙인다.
  - 홈 화면 이름은 앱의 `CFBundleDisplayName` 이라 여기서 정한 이름과는 상관없다.
- **기본 언어:** 한국어
- **번들 ID:** `com.dinoproduct.app`
  - 목록에 없으면 Apple Developer › Certificates, Identifiers & Profiles › Identifiers 에서 먼저 등록한다.
- **SKU:** 팀 안에서 겹치지 않는 아무 문자열 (예: `orbit-ios`)

이어서 TestFlight › 내부 테스트에서 그룹을 만들고 테스터를 넣는다.

- 내부 테스터는 App Store Connect 사용자여야 한다.
- 내부 테스트는 베타 앱 심사 없이 바로 배포된다.

## 매번: Archive → 업로드

1. 최신 main 에서 의존성을 맞춘다.

   ```sh
   git pull
   npm ci
   npm run pods
   ```

2. `xed ios` 로 Xcode 를 연다. 스킴 `DinoApp`, 실행 대상은 **Any iOS Device (arm64)**.
3. **Product › Archive.**
   - Release 구성이라 JS 번들이 앱 안에 들어간다. Metro 는 필요 없다.
4. 끝나면 Organizer 가 열린다. **Distribute App** 을 누르고 **TestFlight & App Store** 를 고른다.
   - Xcode 버전에 따라 이름이 "App Store Connect" 일 수 있다.
   - "TestFlight Internal Only" 로 올린 빌드는 외부 테스트·심사에 쓸 수 없다.
   - 배포 인증서가 없으면 Xcode 가 만든다. 계정 권한이 모자라 실패하면 팀의 Account Holder 또는 Admin 에게 요청한다.
5. 업로드가 끝나면 App Store Connect › TestFlight 에 빌드가 나타난다.
   - 처리(Processing)가 끝나면 내부 테스트 그룹에 빌드를 넣는다.
   - 테스터는 iPhone 의 TestFlight 앱에서 설치한다.

수출 규정은 `Info.plist` 의 `ITSAppUsesNonExemptEncryption = NO` 로 신고돼 있어 업로드마다 묻지 않는다.

- 근거: OS 가 제공하는 HTTPS 외의 암호화를 쓰지 않는다.
- 암호화 라이브러리나 자체 암호화를 넣게 되면 이 값을 다시 판단한다.

## 다음 업로드

- 빌드 번호는 같은 버전 안에서 이전 업로드보다 커야 한다.
  - Archive 전에 Xcode › `DinoApp` 타깃 › General › Identity 의 **Build**(`CURRENT_PROJECT_VERSION`)를 올리고 커밋한다.
- 버전을 올릴 때는 같은 곳의 **Version**(`MARKETING_VERSION`, 지금 1.0)을 바꾼다.

## 막힐 때

- **Archive 가 회색으로 비활성:** 실행 대상이 Any iOS Device 나 연결된 기기가 아니다.
- **Archive 중 `node` 를 찾지 못함:** Xcode 가 셸의 PATH 를 보지 못해서 생긴다.
  - 터미널에서 `which node` 로 경로를 확인한다.
  - `ios/.xcode.env.local` (커밋하지 않는 파일)에 `export NODE_BINARY=<그 경로>` 를 적는다.
- **런치 화면에 "Powered by React Native" 가 보임:** 새 런치 화면 디자인(#21) 대기 중이다. 내부 테스트에는 지장 없다.
