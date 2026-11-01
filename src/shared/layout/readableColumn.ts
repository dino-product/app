import { StyleSheet } from 'react-native';

// Figma 는 휴대폰 세로 디자인뿐이다. 큰 화면(태블릿, 펼친 폴더블)은 방향을 고정하지 않으므로(#56)
// 창이 넓어져도 카드·버튼이 창 폭만큼 늘어나지 않게 본문을 이 폭 안에서 가운데 정렬한다.
// 값은 Material 3 창 크기 클래스의 Compact 상한(600dp)이다. 휴대폰 세로는 거의 모두 Compact 라서,
// 휴대폰에 맞춘 배치가 휴대폰에서 쓰이는 폭을 넘지 않는다. 휴대폰과 iPhone(세로 최대 440pt)에서는 창 폭 그대로다.
export const READABLE_MAX_WIDTH = 600;

// 화면 배경과 하단 탭 바는 창 전체를 덮고, 그 안의 헤더·본문·하단 버튼을 이 기둥에 넣는다.
// 스타일만으로 정해지므로 회전·창 크기 변경 때 레이아웃이 다시 계산한다.
// 스크롤 뷰는 contentContainerStyle 에 줘서 기둥 양옆 빈 곳에서도 스크롤되게 한다
export const { readableColumn } = StyleSheet.create({
  readableColumn: {
    width: '100%',
    maxWidth: READABLE_MAX_WIDTH,
    alignSelf: 'center',
  },
});
