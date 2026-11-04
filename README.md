# Orbit

React Native(순수 CLI, Expo 미사용) 크로스 플랫폼 앱. iOS 는 Xcode 네이티브 빌드로 실기기에 설치한다.

- 작업 방식: 티켓(GitHub Issue) 기반 + TDD → [docs/workflow.md](docs/workflow.md)
- 성능 예산 (버벅임·발열 방지) → [docs/performance.md](docs/performance.md), 값은 [`performance-budget.json`](performance-budget.json)
- 실기기 설치 → [docs/device-build.md](docs/device-build.md)
- TestFlight 업로드 → [docs/testflight.md](docs/testflight.md)

## 스택

| 항목         | 버전 / 선택                                                |
| ------------ | ---------------------------------------------------------- |
| React Native | 0.88 (New Architecture, Hermes)                            |
| React        | 19.3                                                       |
| 언어         | TypeScript                                                 |
| 테스트       | Jest, React Native Testing Library 14, Reassure(렌더 성능) |
| iOS          | Xcode 26, CocoaPods, 최소 iOS 15.1                         |
| Android      | compileSdk 37, minSdk 24, NDK 27.1                         |

## 요구 환경

- Node 24 (`.nvmrc`), npm
- Ruby + Bundler (CocoaPods 용)
- Xcode 26 — iOS
- JDK 17 이상, Android SDK (`ANDROID_HOME`) — Android
- 시뮬레이터 / 에뮬레이터는 쓰지 않는다. 실기기로 확인한다.

## 시작하기

```sh
npm ci            # 의존성 + git 훅(husky) 설치
bundle install    # 최초 1회
npm run pods      # iOS 네이티브 의존성
npm start         # Metro (Debug 빌드용)
```

실기기 실행: `npm run ios` / `npm run android` (USB 연결 필요, 자세한 절차는 [docs/device-build.md](docs/device-build.md))

### API 서버 주소

빌드할 때 `ORBIT_API_BASE_URL` 을 번들에 넣는다 (`src/shared/api/config.ts`). 비밀 값이 아니다.

- Debug 에 값이 없으면 `http://localhost:8080`. 실기기에서 localhost 는 기기 자신이라, iOS 는 맥의 IP 를 넣고 Android 는 `adb reverse tcp:8080 tcp:8080` 을 쓴다
  ```sh
  ORBIT_API_BASE_URL=http://192.168.0.10:8080 npm start
  ```
- Metro 는 값마다 변환 캐시를 따로 쓴다 (`metro.config.js` 의 `cacheVersion`). 값을 바꾸면 Metro 를 다시 띄우기만 하면 된다
- Release 는 `https://` 주소만 쓴다. 값이 없으면 앱은 열리지만 서버 요청이 설정 오류로 실패한다. Xcode 빌드는 `ios/.xcode.env.local` 에 `export ORBIT_API_BASE_URL=…` 를 둔다

## 스크립트

| 명령                                    | 내용                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `npm test`                              | 단위·컴포넌트 테스트                                                                     |
| `npm run test:watch`                    | TDD 용 watch 모드                                                                        |
| `npm run test:coverage`                 | 커버리지 (80% 미만이면 실패)                                                             |
| `npm run test:perf`                     | Reassure 렌더 성능 테스트 (`*.perf-test.tsx`)                                            |
| `npm run perf:baseline`                 | Reassure baseline 저장 (비교 기준)                                                       |
| `npm run perf:bundle`                   | Release JS 번들 크기 예산 검사                                                           |
| `npm run lint` / `typecheck` / `format` | 정적 검사 / 포맷                                                                         |
| `npm run verify`                        | 위 검사 전부 (PR 전 로컬 확인)                                                           |
| `npm run ios` / `ios:release`           | iPhone 실기기에 Debug / Release 설치                                                     |
| `npm run android` / `android:release`   | Android 실기기에 Debug / Release 설치                                                    |
| `npm run icons:android`                 | iOS 앱 아이콘(`AppIcon.png`)으로 Android 런처 아이콘 생성. iOS 아이콘을 바꾸면 다시 실행 |

## 구조

```
src/
  app/            앱 루트 (Provider, 내비게이션)
  features/<이름>/ 기능 단위 화면·로직·테스트
  shared/         공용 모듈 (perf/ : 성능 예산·프레임 모니터, design-system/ : 토큰·공통 컴포넌트)
assets/fonts/     Pretendard (iOS·Android 가 같은 파일을 번들)
scripts/          예산 검사, 커밋 메시지 검사 (lib/ 는 테스트 대상)
performance-budget.json   성능 예산 단일 출처
```

테스트는 대상 파일 옆에 둔다: `Foo.tsx` → `Foo.test.tsx`, 렌더 성능은 `Foo.perf-test.tsx`.

## 디자인 시스템

Figma `Design.v0` › DesignSystem 페이지가 원본이다. 색·글꼴을 하드코딩하지 말고 `src/shared/design-system` 에서 가져온다.

```tsx
import { colors, CTA, Text } from '../shared/design-system';

<Text variant="Body/S/Bold" color={colors.gray[700]}>오늘 일정</Text>
<CTA label="작업 시작" onPress={start} />
```

- `colors` — Figma 변수와 1:1 (`InProgress/2` → `colors.inProgress[2]`)
- `typography` / `<Text variant>` — Figma 텍스트 스타일 이름 그대로 (`Body/XS/Medium` 등)
- 컴포넌트 (Figma 컴포넌트 이름)
  - `CTA` — CTA (Bottom L·M / Modal, primary·secondary·outline·reject)
  - `StatusChip` — 작업상태 컬러칩(M) · 작업 상세 컬러 칩(S)
  - `TabBar` — Tab Bar (밑줄 + 건수), `TypeTabs` — Tab / Type (알약 필터)
  - `Toggle` — Toggle
  - `BottomNavigationBar` — Bottom Navigation Bar (아이콘은 `renderIcon` 으로 주입)
- 폰트를 추가하려면 `assets/fonts` 에 PostScript 이름과 같은 파일명으로 넣고, iOS 는 `Info.plist` 의 `UIAppFonts` 와 Xcode `Fonts` 그룹에 등록한다 (Android 는 자동).
