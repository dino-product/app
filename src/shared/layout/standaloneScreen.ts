import { StyleSheet } from 'react-native';
import { colors } from '../design-system';

// 하단 탭 없이 열리는 화면(온보딩 등)의 틀. 아래 버튼 줄은 Figma 하단 바(높이 102)대로 버튼 위 14, 아래 32 이고,
// 홈 인디케이터가 32 보다 크면 그만큼 띄운다 (bottom: 'maximum'). 탭 안 화면은 탭 바가 아래를 덮어 위 안전 영역만 쓴다
export const STANDALONE_SCREEN_EDGES = {
  top: 'additive',
  bottom: 'maximum',
} as const;

export const standaloneScreen = StyleSheet.create({
  screen: { flex: 1, paddingBottom: 32, backgroundColor: colors.white[100] },
  actions: { paddingHorizontal: 24, paddingTop: 14 },
});
