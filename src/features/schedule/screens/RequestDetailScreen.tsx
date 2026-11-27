import { useRef, type Ref } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInstance,
} from 'react-native';
import {
  colors,
  CTA,
  Icon,
  ICON_HIT_SLOP,
  Text,
} from '../../../shared/design-system';
import { haptic } from '../../../shared/haptics';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { noOverscroll } from '../../../shared/layout/noOverscroll';
import { WorkInfoSections } from '../../work/components/WorkInfoSections';
import type { WorkDetail, WorkPlace } from '../../work/model';
import { ScreenSafeAreaView } from '../../../shared/layout/ScreenSafeAreaView';

// Figma 스케줄 › 응답 필요 작업의 상세 (하단 거절 / 수락)
export function RequestDetailScreen({
  work,
  onBack,
  onAccept,
  onReject,
  onCall,
  onNavigate,
  onOpenMap,
  titleRef,
}: {
  work: WorkDetail;
  onBack: () => void;
  /** 수락한다. 서버가 받았으면 true (낙관 반영·실패 안내는 부른 쪽이 한다) */
  onAccept: () => Promise<boolean>;
  /** 거절 사유 화면으로 */
  onReject: () => void;
  onCall: (phone: string) => void;
  onNavigate: (place: WorkPlace) => void;
  /** 작업 위치 지도를 누르면 그 위치를 지도 앱에서 연다 */
  onOpenMap: (place: WorkPlace) => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  // 수락(POST)은 낙관적으로 반영한다 (#197). 보내는 동안 버튼 모양(Figma 기본)은 그대로 두고, 다시 누른 수락과
  // 거절만 받지 않는다. 비활성으로 바꾸면 거절이 Disabled 채움으로 까맣게 변한다. 결과가 오면(실패) 다시 받는다
  const accepting = useRef(false);
  const accept = async () => {
    if (accepting.current) {
      return;
    }
    accepting.current = true;
    try {
      // 햅틱은 결과다: 서버가 수락을 받았을 때만 울린다 (#32)
      if (await onAccept()) {
        haptic.success();
      }
    } finally {
      accepting.current = false;
    }
  };
  const reject = () => {
    if (!accepting.current) {
      onReject();
    }
  };

  return (
    <ScreenSafeAreaView bottom style={styles.screen}>
      <View style={[readableColumn, styles.header]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={ICON_HIT_SLOP}
          onPress={onBack}
          style={styles.back}
        >
          <Icon name="chevron-left" />
        </Pressable>
        <Text
          ref={titleRef}
          accessibilityRole="header"
          variant="Body/M/SemiBold"
          color={colors.mainText}
        >
          작업 상세
        </Text>
      </View>
      <ScrollView
        {...noOverscroll}
        contentContainerStyle={[readableColumn, styles.content]}
      >
        {/* 현장 사진(Figma 2714-12566)까지 작업 상세들과 같은 컴포넌트다 (#142) */}
        <WorkInfoSections
          work={work}
          onCall={onCall}
          onNavigate={onNavigate}
          onOpenMap={onOpenMap}
        />
      </ScrollView>
      <View style={[readableColumn, styles.actions]}>
        <CTA
          variant="outline"
          label="거절"
          onPress={reject}
          style={styles.action}
        />
        <CTA label="수락" onPress={accept} style={styles.action} />
      </View>
    </ScreenSafeAreaView>
  );
}

// Figma 2714:12494 아래 바: 큰 버튼(56) 사이 10, 위 14, 아래 32 는 홈 인디케이터 자리다 (거절 사유 화면과 같다).
// 안전 영역이 더 크면 그만큼, 없는 기기도 32 를 둔다

const styles = StyleSheet.create({
  screen: { flex: 1, paddingBottom: 32, backgroundColor: colors.white[100] },
  header: { height: 56, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: 20 },
  content: { paddingBottom: 24 },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  action: { flex: 1 },
});
