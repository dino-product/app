import { StyleSheet } from 'react-native';
import { colors } from '../../../../shared/design-system';
import {
  STANDALONE_SCREEN_EDGES,
  standaloneScreen,
} from '../../../../shared/layout/standaloneScreen';
import type { JoinFlow } from '../model';

// 회사 참여 화면의 틀은 흐름마다 다르다.
// 마이: 하단 탭 바 위라 위 안전 영역만 쓰고, 아래 버튼 줄은 위아래 12 (#73)
// 온보딩: 탭이 없어 아래 안전 영역(최소 32)을 띄우고, 버튼 위 14 (Figma 하단 바 102, #85)
const styles = StyleSheet.create({
  myScreen: { flex: 1, backgroundColor: colors.white[100] },
  myActions: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 },
});

export const flowLayouts = {
  my: {
    edges: ['top'],
    screen: styles.myScreen,
    actions: styles.myActions,
  },
  onboarding: {
    edges: STANDALONE_SCREEN_EDGES,
    screen: standaloneScreen.screen,
    actions: standaloneScreen.actions,
  },
} as const satisfies Record<JoinFlow, unknown>;
