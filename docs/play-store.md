# Play 내부 테스트 업로드 (Android)

업로드 키로 서명한 AAB 를 로컬에서 만들어 Play Console 에 직접 올린다.

| 항목         | 값                                                                          |
| ------------ | --------------------------------------------------------------------------- |
| 홈 화면 이름 | Orbit (`android/app/src/main/res/values/strings.xml` `app_name`)            |
| 패키지 이름  | `com.dinoproduct.app` — 앱을 만들 때 넣는다. 바꾸거나 다시 쓸 수 없다       |
| 서명         | Play 앱 서명. 앱 서명 키는 Google 이 보관하고, 우리는 업로드 키로 서명한다  |
| 올리는 파일  | AAB (`./gradlew bundleRelease`). 새 앱은 APK 로 올릴 수 없다                |
| 버전         | `android/app/build.gradle` 의 `versionCode`(지금 1)·`versionName`(지금 1.0) |
| targetSdk    | 36 — 2026-08-31 부터 새 앱·업데이트는 API 36 이상이어야 한다                |

## 전제

- **계정:** Play Console 개발자 계정이 있어야 한다.
  - 계정 종류(개인·조직)와 신원 확인 상태는 Play Console › 설정 › 개발자 계정에서 본다.
  - 개인 계정 소유자는 Play Console 모바일 앱으로 실제 Android 기기(Android 10 이상)를 가지고 있음을 인증해야 한다.
- **개인 계정이면:** 2023-11-13 이후 만든 개인 계정은 프로덕션에 내기 전에 비공개 테스트를 거쳐야 한다.
  - 테스터 12명 이상이 직전 14일 동안 계속 참여(opt-in)하고 있어야 한다. 중간에 나갔다 다시 들어오면 이어지지 않는다.
  - 내부 테스트만 할 때는 해당 없다.
  - 내부 테스트에 참여한 사람은 비공개 테스트 대상이 되지 않는다. 같은 사람을 12명에 넣으려면 내부 테스트에서 먼저 나가야 한다.
- **패키지 이름 등록:** 2026-09-30 부터 Play 의 모든 패키지 이름은 Android 개발자 인증에 등록돼 있어야 한다.
  - 신원 확인을 마친 계정이면 Google 이 새 앱도 자동으로 등록하려고 한다.
  - 상태는 Play Console 홈의 앱 목록 위 알림과 Android 개발자 인증 페이지에서 본다. 자동 등록이 안 됐으면 그 페이지의 안내대로 등록한다.
- **업로드 키:** 아래 '처음 한 번: 업로드 키'를 마쳐야 한다. 키가 없으면 release 도 debug 키로 서명되고, Play 는 debug 키로 서명한 앱을 받지 않는다.

## 처음 한 번: 업로드 키

키와 비밀번호는 저장소에 넣지 않는다. `*.keystore`, `*.jks`, `*.p12`, `*.pfx` 는 `.gitignore` 대상이다.

비밀번호를 묻는 `keytool` 명령은 `| grep` 같은 파이프로 잇지 않는다. 파이프로 이으면 입력한 비밀번호가 화면에 그대로 찍힌다.

1. 저장소 밖에서 키를 만든다. 비밀번호와 인증서 정보(이름·조직 등)를 묻는다.

   ```sh
   mkdir -p ~/.android/keystores
   keytool -genkeypair -v -storetype PKCS12 \
     -keystore ~/.android/keystores/orbit-upload.keystore \
     -alias orbit-upload -keyalg RSA -keysize 2048 -validity 10000
   ```

   - `reactnative.dev` 의 명령에서 경로와 별칭만 바꿨다.
   - `-validity 10000` 은 약 27년이다. Android 문서는 키를 25년 이상 유효하게 만들라고 권한다.
   - PKCS12 는 키 비밀번호를 따로 받지 않고 저장소 비밀번호를 쓴다.

2. 인증서(공개 정보)를 내보내 둔다. 매번 서명을 확인할 때 비밀번호 없이 쓴다.

   ```sh
   keytool -exportcert -rfc \
     -keystore ~/.android/keystores/orbit-upload.keystore \
     -alias orbit-upload -file ~/.android/keystores/orbit-upload.pem
   ```

3. 키 파일과 비밀번호를 비밀번호 관리자 등 저장소 밖 한 곳에 따로 보관한다. 이 컴퓨터가 망가져도 다시 꺼낼 수 있어야 한다.
4. `~/.gradle/gradle.properties`(사용자 전역, 저장소 밖)에 속성 넷을 적는다. 값은 자기 것으로 바꾼다.

   ```properties
   ORBIT_UPLOAD_STORE_FILE=/Users/<나>/.android/keystores/orbit-upload.keystore
   ORBIT_UPLOAD_STORE_PASSWORD=<비밀번호>
   ORBIT_UPLOAD_KEY_ALIAS=orbit-upload
   ORBIT_UPLOAD_KEY_PASSWORD=<비밀번호>
   ```

   | 속성                          | 뜻                                               |
   | ----------------------------- | ------------------------------------------------ |
   | `ORBIT_UPLOAD_STORE_FILE`     | 키 파일 절대 경로. `~` 는 펼쳐지지 않는다        |
   | `ORBIT_UPLOAD_STORE_PASSWORD` | 키 저장소 비밀번호                               |
   | `ORBIT_UPLOAD_KEY_ALIAS`      | 키 별칭 (`-alias` 로 준 값)                      |
   | `ORBIT_UPLOAD_KEY_PASSWORD`   | 키 비밀번호. PKCS12 면 저장소 비밀번호와 같은 값 |

   - 이 파일은 Java properties 형식이다. 값의 `\` 는 `\\` 로 적는다. 앞뒤 공백은 지워진다. 영숫자로만 된 비밀번호가 가장 덜 헷갈린다.
   - 다른 사람이 읽지 못하게 한다: `chmod 600 ~/.gradle/gradle.properties`
   - `./gradlew properties` 는 이 값을 평문으로 찍는다. 그 출력을 이슈·PR·로그에 붙이지 않는다.

   속성에 따라 release 서명이 이렇게 정해진다.

   - 넷 다 있으면 release 를 업로드 키로 서명한다. 로컬 release 실행(`npm run android:release`)도 업로드 키로 서명된다.
   - 넷 다 없으면 지금처럼 debug 키로 서명한다. 업로드 키를 넣기 전의 로컬과 CI 가 이 경우다.
   - 일부만 있으면 debug 빌드까지 모든 빌드가 멈추고, 빠진 속성 이름을 알려 준다.
   - CI 에서 업로드 키로 서명하려면 같은 이름 앞에 `ORG_GRADLE_PROJECT_` 를 붙인 환경 변수를 CI 비밀값으로 준다. 지금 CI 는 업로드 키로 서명하지 않는다. 켤 때 주의할 점:
     - `ORBIT_UPLOAD_STORE_FILE` 은 러너의 파일 경로여야 한다. 키 파일을 base64 비밀값으로 넣고 임시 파일로 풀어 그 경로를 준다.
     - PR 브랜치는 `build.gradle` 을 고쳐 키를 빼낼 수 있다. 서명은 `pull_request` 가 아니라 수동 실행(`workflow_dispatch`)과 보호된 environment 에서만 한다.

## 처음 한 번: Play Console 에 앱 만들기

Play Console › 모든 앱 › 앱 만들기

- **앱 이름:** Orbit
  - 스토어에 보이는 이름이다. 30자까지. 홈 화면 이름은 `app_name` 이라 여기서 정한 이름과는 상관없다.
  - 첫 검토 전까지 Play 는 테스터에게 임시 이름을 보여 준다.
- **패키지 이름:** `com.dinoproduct.app`
  - `android/app/build.gradle` 의 `applicationId` 와 같아야 한다. 다르면 AAB 가 올라가지 않는다.
  - 한 번 쓴 패키지 이름은 바꾸거나 지우거나 다시 쓸 수 없다. 오타가 없는지 확인하고 넣는다.
- **기본 언어:** 한국어
- **앱 또는 게임:** 앱
- **무료 또는 유료:** 무료
  - 나중에 무료를 유료로 바꿀 수 없다.
- **연락처 이메일:** 사용자가 이 앱에 대해 연락할 이메일. 스토어 등록정보에 보인다.
- **선언:** 개발자 프로그램 정책, 미국 수출 법규, Play 앱 서명 약관에 동의한다.

내부 테스트는 앱 설정(스토어 등록정보, 콘텐츠 등급 등)을 마치기 전에도 시작할 수 있다. 데이터 보안 섹션도 내부 테스트만 할 때는 면제된다. 그 항목들은 프로덕션 전에 채운다.

이어서 테스트 및 출시 › 테스트 › 내부 테스트 › 테스터 탭에서 테스터를 정한다.

- 이메일 목록을 만들고 테스터의 Google 계정 이메일을 넣는다. 최대 100명이다.
- 내부 테스트는 이메일 목록만 쓴다. Google 그룹은 비공개 테스트용이다.
- 참여 링크는 첫 버전을 게시한 뒤('게시됨' 상태)에 보인다. 아래 '매번'을 마친 뒤 복사해 보낸다.

## 매번: AAB 빌드 → 업로드

1. `versionCode` 를 올린 PR 이 main 에 병합돼 있어야 한다 (아래 '다음 업로드'). 첫 업로드는 저장소 값 1 그대로 올린다.
2. 최신 main 에서 의존성을 맞춘다.

   ```sh
   git pull
   npm ci
   ```

3. AAB 를 만든다. Release 라 JS 번들이 앱 안에 들어간다. Metro 는 필요 없다.

   ```sh
   cd android
   ./gradlew bundleRelease
   ```

   결과물: `android/app/build/outputs/bundle/release/app-release.aab`

4. 업로드 키로 서명됐는지 확인한다. `android` 폴더에서 실행한다. 비밀번호를 묻지 않는다.

   ```sh
   keytool -printcert -jarfile app/build/outputs/bundle/release/app-release.aab | grep SHA256
   keytool -printcert -file ~/.android/keystores/orbit-upload.pem | grep SHA256
   ```

   - 두 SHA256 이 같아야 한다.
   - `FA:C6:17:45:…:3B:9C` 이면 저장소의 debug 키로 서명된 것이다. 속성이 읽히지 않았으니 '처음 한 번: 업로드 키' 4단계를 다시 본다.

5. Play Console › 테스트 및 출시 › 테스트 › 내부 테스트 › 새 버전 만들기
   - **첫 버전 때 한 번:** Play 앱 서명을 설정한다. 기본값(Google 이 만든 앱 서명 키)을 그대로 쓴다.
     - 앱 서명 키를 Google 이 만들면, 첫 버전에 서명한 키가 업로드 키가 된다. 그래서 4단계 확인이 중요하다.
   - AAB 를 올리고 출시 노트를 적는다.
   - 다음을 누르고 검토 화면을 본다. 오류는 게시를 막고, 경고만 있으면 게시할 수 있다.
   - 게시(출시)한다.
6. 테스터에게 참여 링크를 보낸다(첫 번째만). 테스터는 링크에서 참여한 뒤 Play 스토어에서 설치한다.
   - 내부 테스트 앱은 Play 스토어 검색에 나오지 않는다. 링크로 들어가야 한다.
   - 새 버전은 보통 몇 분 안에 테스터에게 간다. 처음 게시한 뒤에는 참여 링크가 동작하기까지 몇 시간 걸릴 수 있다.

## 다음 업로드

- **versionCode:** 업로드마다 1 올린다. 손으로 고치고 커밋한다.
  - 순서: 티켓(출시 티켓 등)에서 `android/app/build.gradle` 의 `versionCode` 를 1 올리는 PR 을 병합한다 → '매번' 1단계부터 한다.
  - 커밋 예: `chore(#<이슈>): versionCode 2`
  - Play 는 이미 쓴 `versionCode` 를 다시 받지 않는다. Xcode 처럼 업로드할 때 알아서 올려 주지 않는다.
  - 업로드는 업로드 키가 있는 로컬에서 하므로 CI 실행 번호를 쓰지 않는다.
  - 시각이나 커밋 수로 계산하지 않는다. 같은 커밋에서 빌드해도 번호가 달라지거나, CI 의 얕은 clone 에서 틀린다.
  - 저장소 값이 곧 마지막으로 올린 번호다. Play 에 보이는 빌드 N 의 커밋은 `git log -G '^[[:space:]]*versionCode N$' -- android/app/build.gradle` 로 찾는다.
  - 최대값은 2100000000 이다.
  - CI 에서 직접 업로드하게 되면 그때 CI 실행 번호로 바꾼다.
- **버전 이름:** 새 버전을 낼 때 `versionName` 을 iOS `MARKETING_VERSION` 과 같은 값으로 올린다.
- **R8 축소:** 꺼져 있다 (`enableProguardInReleaseBuilds = false`). 켜려면 Release 실기기에서 화면을 한 번씩 열어 확인해야 한다. 검토 결과와 켤 때 할 일은 #57 댓글에 있다.

## 막힐 때

- **Play Console 이 debug 인증서로 서명했다며 AAB 를 받지 않는다**
  - 원인: 업로드 키 속성이 읽히지 않아 debug 키로 서명됐다.
  - 해결: '매번' 4단계로 서명을 확인한다. `~/.gradle/gradle.properties` 의 속성 이름이 `ORBIT_UPLOAD_` 으로 시작하는지 본다.
- **빌드가 "업로드 키 속성이 일부만 있다" 로 멈춘다**
  - 원인: 속성 넷 중 일부만 있다. debug 빌드도 같은 이유로 멈춘다.
  - 해결: 메시지에 나온 속성을 채운다. debug 로 서명하려면 넷 다 지운다.
- **빌드가 키 저장소 파일을 찾지 못한다**
  - 원인: `ORBIT_UPLOAD_STORE_FILE` 경로가 틀렸다. `~` 나 상대 경로는 `android/app` 기준으로 풀린다.
  - 해결: 절대 경로로 적는다.
- **빌드가 "Keystore was tampered with, or password was incorrect" 로 멈춘다**
  - 원인: 비밀번호가 틀렸다. `gradle.properties` 가 `\` 를 이스케이프로 읽어 값이 바뀌었을 수 있다.
  - 해결: 값의 `\` 를 `\\` 로 적는다. 비밀번호 관리자에 보관한 값과 같은지 본다.
- **업로드 키가 다르다며 AAB 를 받지 않는다**
  - 원인: 처음 등록된 업로드 키가 아닌 키로 서명했다.
  - 해결: 보관해 둔 업로드 키를 쓴다.
  - 키를 잃어버렸거나 새어 나갔다면 업로드 키 재설정을 요청한다. 앱 서명 키는 Google 이 보관하므로 앱은 그대로 업데이트할 수 있다.
    1. 새 업로드 키를 만든다 ('처음 한 번: 업로드 키' 1단계).
    2. 인증서를 내보낸다: `keytool -export -rfc -keystore <새 키 파일> -alias orbit-upload -file upload_certificate.pem`
    3. Play Console › Google Play로 보호됨 › Play 스토어 보호 › Play 앱 서명 관리 (영문 UI: Protected with Play › Play Store protection › Manage Play app signing)
    4. 업로드 키 인증서 섹션에서 업로드 키 재설정 요청을 누르고, 이유를 적고, PEM 을 올린다.
- **같은 버전 코드라며 AAB 를 받지 않는다**
  - 원인: 이전에 올린 `versionCode` 와 같거나 작다.
  - 해결: `versionCode` 를 올리고 다시 빌드한다.
- **새 버전 만들기 버튼이 눌리지 않는다**
  - 원인: 대시보드의 설정 작업이 남았거나, 끝내지 않은 버전이 있거나, 권한(테스트 트랙에 출시)이 없다.
  - 해결: 대시보드에서 남은 작업을 확인한다.
- **실기기 설치가 `INSTALL_FAILED_UPDATE_INCOMPATIBLE` 로 실패한다**
  - 원인: 같은 패키지가 다른 키로 서명돼 이미 깔려 있다. Play 에서 받은 앱은 Google 의 앱 서명 키, 로컬 빌드는 debug 키나 업로드 키로 서명된다.
  - 해결: `adb uninstall com.dinoproduct.app` 로 지우고 다시 설치한다. 앱 데이터도 지워진다.
