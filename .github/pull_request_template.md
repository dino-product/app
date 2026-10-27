## 연결된 티켓

Closes #

## 변경 사항

-

## TDD

- [ ] 실패하는 테스트를 먼저 작성하고 실패 이유를 확인했다 (Red)
- [ ] 최소 구현으로 통과시켰다 (Green)
- [ ] 리팩터링 후에도 전체 테스트가 통과한다 (Refactor)

## 성능 예산 (`performance-budget.json`, `docs/performance.md`)

- [ ] 가변 길이 리스트는 `FlatList`/`SectionList` 로 가상화했다 (`ScrollView` + `map` 아님)
- [ ] 애니메이션은 UI 스레드에서 돈다 (`useNativeDriver: true` 또는 Reanimated)
- [ ] 화면 이탈 / 백그라운드 전환 시 타이머·구독·센서를 해제한다
- [ ] 새 의존성을 추가했다면 `npm run perf:bundle` 결과가 예산 이내다
- [ ] 무거운 화면·네이티브 변경이라면 Release 빌드 실기기 측정 결과를 첨부했다

## 플랫폼 확인

- [ ] iOS (Xcode 빌드)
- [ ] Android (선택 — 불시 USB 점검 대상, 매 PR 필수 아님)
