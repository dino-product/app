# Dino

React Native(순수 CLI, Expo 미사용) 크로스 플랫폼 앱. iOS 는 Xcode 네이티브 빌드로 실기기에 설치한다.

- 작업 방식: 티켓(GitHub Issue) 기반 + TDD → [docs/workflow.md](docs/workflow.md)
- 성능 예산 (버벅임·발열 방지) → [docs/performance.md](docs/performance.md), 값은 [`performance-budget.json`](performance-budget.json)
- 실기기 설치 → [docs/device-build.md](docs/device-build.md)

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

## 스크립트

| 명령                                    | 내용                                          |
| --------------------------------------- | --------------------------------------------- |
| `npm test`                              | 단위·컴포넌트 테스트                          |
| `npm run test:watch`                    | TDD 용 watch 모드                             |
| `npm run test:coverage`                 | 커버리지 (80% 미만이면 실패)                  |
| `npm run test:perf`                     | Reassure 렌더 성능 테스트 (`*.perf-test.tsx`) |
| `npm run perf:baseline`                 | Reassure baseline 저장 (비교 기준)            |
| `npm run perf:bundle`                   | Release JS 번들 크기 예산 검사                |
| `npm run lint` / `typecheck` / `format` | 정적 검사 / 포맷                              |
| `npm run verify`                        | 위 검사 전부 (PR 전 로컬 확인)                |
| `npm run ios` / `ios:release`           | iPhone 실기기에 Debug / Release 설치          |
| `npm run android` / `android:release`   | Android 실기기에 Debug / Release 설치         |

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
- `Icon` — Figma 에서 SVG 로 내보낸 아이콘 (`react-native-svg` 의 `SvgXml`). 기본 크기·색은 Figma 값이고, 한 가지 색 아이콘만 `color` 로 바꿀 수 있다
  - 아이콘 추가: Figma 에서 레이어를 SVG 로 Export → `src/shared/design-system/icons/svgs.ts` 에 넣고, 한 가지 색이면 그 색을 `currentColor` 로 바꾸고 원래 색을 `color` 로 적는다
  - 레이어 이름에 `/` 가 있으면 Figma 가 `Design.v0.zip` 으로 묶어 내보낸다 (zip 안에 SVG 가 있다)
  - 일러스트처럼 Figma 에 이미지(PNG)로 들어간 것은 `assets/images` 의 PNG 로 쓴다
- 폰트를 추가하려면 `assets/fonts` 에 PostScript 이름과 같은 파일명으로 넣고, iOS 는 `Info.plist` 의 `UIAppFonts` 와 Xcode `Fonts` 그룹에 등록한다 (Android 는 자동).
