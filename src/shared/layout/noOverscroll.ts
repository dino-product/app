// 새로고침이 필요 없는 화면의 스크롤 뷰에 펼쳐 넣는다 (#103): <ScrollView {...noOverscroll} />.
// 맨 위에서 아래로 끌어도 내용이 내려오지 않는다 (iOS 바운스, Android 오버스크롤 효과). 아래쪽 바운스도 함께 없어진다.
// 서버 목록이라 이후 당겨서 새로고침을 붙일 화면(내 작업 홈·내 일정·작업 이력·알림센터·신청 현황)에는 쓰지 않는다.
// 바텀 시트·모달 안의 스크롤은 범위 밖이다
export const noOverscroll = {
  bounces: false,
  overScrollMode: 'never',
} as const;
