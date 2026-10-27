#!/usr/bin/env bash
# 티켓 라벨 체계를 GitHub 레포에 만든다. 여러 번 실행해도 안전하다 (--force 로 갱신).
# 사용법: scripts/github/setup-labels.sh [owner/repo]
set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"

label() {
  gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force
}

# 종류
label "type:feature" "1D76DB" "사용자에게 보이는 기능"
label "type:bug"     "D73A4A" "의도와 다른 동작"
label "type:perf"    "FBCA04" "성능 예산 위반 / 개선"
label "type:chore"   "C5DEF5" "설정, 인프라, 리팩터링"
label "type:docs"    "0075CA" "문서"
label "type:test"    "BFD4F2" "테스트 보강"

# 진행 상태
label "status:triage"      "EDEDED" "분류 대기"
label "status:ready"       "0E8A16" "착수 가능 (수용 기준 확정)"
label "status:in-progress" "5319E7" "작업 중"
label "status:in-review"   "8250DF" "PR 리뷰 중"
label "status:blocked"     "B60205" "외부 요인으로 막힘"

# 우선순위
label "priority:p0" "B60205" "즉시"
label "priority:p1" "D93F0B" "이번 마일스톤"
label "priority:p2" "FEF2C0" "여유 있을 때"

# 플랫폼
label "platform:ios"     "000000" "iOS 한정"
label "platform:android" "3DDC84" "Android 한정"
