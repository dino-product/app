# Dino — 에이전트 작업 규칙

React Native 0.88 (순수 CLI, Expo 미사용) · TypeScript · iOS 는 Xcode 네이티브 빌드.

## 반드시 지킬 것

1. **티켓 먼저.** 작업은 GitHub Issue 에 연결한다. 커밋 형식 `<type>(#<이슈>): <내용>` (commit-msg 훅이 강제). 브랜치 `<type>/<이슈>-<설명>`. PR 본문 `Closes #<이슈>`. → `docs/workflow.md`
2. **TDD.** 테스트를 먼저 쓰고, 의도한 이유로 실패하는 것을 확인한 뒤 최소 구현. 테스트는 대상 옆 `*.test.ts(x)`, 렌더 성능은 `*.perf-test.tsx`.
3. **성능 예산.** `performance-budget.json` 이 단일 출처. 예산을 넘기는 코드를 쓰지 말고, 예산 값을 바꾸려면 `type:perf` 티켓으로 근거를 남긴다. 코드 규칙은 `docs/performance.md`.
4. **Android 실기기 확인은 매 작업 필수가 아니다.** 사용자가 불시에 USB 로 연결해 점검한다. 작업 완료 조건에 Android 빌드·실행을 넣지 않는다.
5. **시뮬레이터 / 에뮬레이터 금지.** 로컬 머신에 너무 무겁다. `run-ios`, `run-android` 는 실기기(`--device`, `--active-arch-only`)로만. 로컬 네이티브 빌드 검증이 필요하면 먼저 사용자에게 묻고, 가능하면 CI(`native-build.yml`)로 넘긴다.

## 명령

```sh
npm test                 # 단위·컴포넌트 테스트
npm run test:coverage    # 커버리지 80% 기준
npm run test:perf        # Reassure 렌더 예산
npm run perf:bundle      # Release 번들 크기 예산
npm run lint && npm run typecheck
npm run verify           # 위 전부
```

## 테스트 작성 (RNTL v14)

- `render`, `renderHook`, `rerender`, `unmount` 는 **async** — `await render(<X />)`.
- `screen.getByRole` 우선, 상호작용은 `userEvent`.
- `react-native-safe-area-context` 는 `jest/setup.js` 에서 목 처리됨.
- jest preset 의 `AppState.currentState` 는 함수 목이라 `Object.defineProperty` 로 값을 넣는다 (`useFrameMonitor.test.ts` 참고).
