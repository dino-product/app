# TestFlight 업로드 (iOS)

Xcode 에서 직접 Archive 해서 올린다.

| 항목         | 값                                                         |
| ------------ | ---------------------------------------------------------- |
| 홈 화면 이름 | Orbit (`Info.plist` `CFBundleDisplayName`)                 |
| 번들 ID      | `com.dinoproduct.app` — 첫 빌드를 올린 뒤에는 바꿀 수 없다 |
| 팀           | `B8Q8XMT6LP`, 자동 서명                                    |
| Xcode        | 26 이상 — 2026-04-28 부터 iOS 26 SDK 로 빌드한 앱만 받는다 |
| Xcode 스킴   | `DinoApp` (Archive 는 Release 구성)                        |

## 전제

- **팀:** 유료 Apple Developer Program 팀이어야 한다. 무료 Apple ID 로는 TestFlight 에 올릴 수 없다.
- **약관:** Account Holder 가 App Store Connect › 비즈니스에서 최신 약관에 동의해 둬야 앱을 추가할 수 있다.
- **역할:** 앱을 추가할 수 있는 역할은 Account Holder, Admin, App Manager 다.

## 처음 한 번: App Store Connect 에 앱 만들기

App Store Connect › 앱 › ＋ › 신규 앱

- **플랫폼:** iOS
- **이름:** Orbit
  - 2~30자.
  - 같은 언어에서 다른 앱이 이미 쓰는 이름이면 등록되지 않는다. 그때는 이름 뒤에 단어를 덧붙인다 (예: `Orbit 작업`).
  - '부제' 필드를 채워도 이름 충돌은 풀리지 않는다.
  - 심사에 제출하기 전까지는 바꿀 수 있다.
  - 홈 화면 이름은 앱의 `CFBundleDisplayName` 이라 여기서 정한 이름과는 상관없다.
- **기본 언어:** 한국어
- **번들 ID:** `com.dinoproduct.app`
  - 목록에 없으면 Apple Developer › Certificates, Identifiers & Profiles › Identifiers 에서 먼저 등록한다.
- **SKU:** 팀 안에서 겹치지 않는 문자열 (예: `orbit-ios`)
  - 나중에 바꿀 수 없다.
  - 하이픈·마침표·밑줄로 시작할 수 없다.
- **사용자 액세스:** 전체 액세스

앱 레코드가 없는 채로 Distribute 를 하면 Xcode 가 레코드를 만들자고 제안하기도 한다. 위에서 직접 만드는 쪽이 값을 확인하기 쉽다.

이어서 TestFlight › 내부 테스트에서 그룹을 만들고 테스터를 넣는다.

- 내부 테스터는 App Store Connect 사용자여야 한다.
  - 역할: Account Holder, Admin, App Manager, Developer, Marketing 중 하나
  - 이 앱에 접근할 수 있어야 한다
- 최대 100명이다.
- 내부 테스트는 베타 앱 심사 없이 바로 배포된다. 베타 앱 심사는 외부 테스트에만 있다.

## 매번: Archive → 업로드

1. 최신 main 에서 의존성을 맞춘다. `bundle install` 은 처음이거나 `Gemfile` 이 바뀌었을 때만 한다.

   ```sh
   git pull
   npm ci
   bundle install
   npm run pods
   ```

2. `xed ios` 로 Xcode 를 연다. 스킴은 `DinoApp`, 실행 대상은 **Any iOS Device (arm64)** 로 둔다.
   - Xcode 가 "Update to recommended settings" 를 제안하면 받지 않는다 (아래 '막힐 때' 참고).
3. **Product › Archive.**
   - Release 구성이라 JS 번들이 앱 안에 들어간다. Metro 는 필요 없다.
4. 끝나면 Organizer 가 열린다.
   - **첫 업로드 전 한 번:** **Validate App** 을 누른다. 업로드 검증에서 걸릴 문제를 먼저 알려 준다.
   - **Distribute App** 을 누르고 **TestFlight & App Store** 를 고른다.
     - "TestFlight Internal Only" 로 올린 빌드는 외부 테스트·출시에 쓸 수 없다.
   - **서명:** 자동 서명은 클라우드 관리 배포 인증서를 쓴다. 권한이 모자라 실패하면 팀의 Account Holder 또는 Admin 에게 역할이나 클라우드 관리 인증서 접근 권한을 요청한다.
5. 업로드가 끝나면 App Store Connect › TestFlight 에 빌드가 나타난다.
   - 처리(Processing)가 끝나면 내부 테스트 그룹에 빌드를 넣는다.
   - 테스터는 iPhone 의 TestFlight 앱에서 설치한다.

수출 규정은 `Info.plist` 의 `ITSAppUsesNonExemptEncryption = NO` 로 신고돼 있어 업로드마다 묻지 않는다.

- 근거: OS 가 제공하는 HTTPS 외의 암호화를 쓰지 않는다.
- 다시 판단할 때: API 연동이나 암호화 라이브러리 추가처럼 암호화 사용이 바뀌면, Apple 의 [Complying with Encryption Export Regulations](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations) 로 이 값을 다시 판단한다.
  - 연말 자체 분류 보고 대상인지도 함께 본다.

## 다음 업로드

- **빌드 번호:** TestFlight & App Store 로 배포하면 Xcode 가 업로드할 때 아카이브의 빌드 번호를 알아서 올린다.
  - 그래서 저장소의 빌드 번호(`CURRENT_PROJECT_VERSION`, 지금 1)는 그대로 둔다.
  - TestFlight 에 보이는 번호와 저장소 값이 달라도 된다.
- **버전:** 새 버전을 낼 때는 Xcode › `DinoApp` 타깃 › General › Identity 의 **Version**(`MARKETING_VERSION`, 지금 1.0)을 올리고 커밋한다.

## 막힐 때

- **Archive 중 `node` 를 찾지 못한다**
  - 원인: Xcode 가 셸의 PATH 를 보지 못한다.
  - 해결: `ios/.xcode.env.local`(커밋하지 않는 파일)에 `export NODE_BINARY=<경로>` 를 적는다. 경로는 터미널에서 `which node` 로 확인한다.
  - 이 파일은 `pod install` 때 자동으로 만들어진다. 이미 있다면 nvm 등으로 Node 버전을 바꾼 뒤 남은 예전 경로일 수 있으니 고친다.
- **권장 설정 업데이트를 받은 뒤 스크립트 단계가 sandbox 오류로 실패한다**
  - 원인: User Script Sandboxing(`ENABLE_USER_SCRIPT_SANDBOXING`)이 켜져, RN·CocoaPods 스크립트가 막힐 수 있다.
  - 해결: 변경을 되돌리거나 이 값을 NO 로 둔다.
- **런치 화면에 "Powered by React Native" 가 보인다**
  - 새 런치 화면 디자인(#21) 대기 중이다. 내부 테스트에는 지장 없다.
