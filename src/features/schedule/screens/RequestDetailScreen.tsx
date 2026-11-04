import { useRef, useState, type Ref } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { InfoCard, InfoField, Section } from '../../work/components/InfoCard';
import { PhotoThumb } from '../../work/components/PhotoThumb';
import { WorkInfoSections } from '../../work/components/WorkInfoSections';
import type { WorkDetail } from '../../work/model';

// Figma 스케줄 › 응답 필요 작업의 상세 (하단 거절 / 수락)
export function RequestDetailScreen({
  work,
  onBack,
  onAccept,
  onReject,
  onCall,
  onNavigate,
  titleRef,
}: {
  work: WorkDetail;
  onBack: () => void;
  /** 수락한다. 서버가 받았으면 true (실패 안내는 부른 쪽이 한다) */
  onAccept: () => Promise<boolean>;
  /** 거절 사유 화면으로 */
  onReject: () => void;
  onCall: (phone: string) => void;
  onNavigate: (address: string) => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  // 수락을 보내는 동안 수락·거절을 잠근다. disabled 가 반영되기 전 같은 프레임의 두 번째 탭도 막는다
  const [accepting, setAccepting] = useState(false);
  const acceptingRef = useRef(false);
  const accept = async () => {
    if (acceptingRef.current) {
      return;
    }
    acceptingRef.current = true;
    setAccepting(true);
    try {
      // 햅틱은 결과다: 서버가 수락을 받았을 때만 울린다 (#32)
      if (await onAccept()) {
        haptic.success();
      }
    } finally {
      acceptingRef.current = false;
      setAccepting(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
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
        <WorkInfoSections
          work={work}
          onCall={onCall}
          onNavigate={onNavigate}
          showRequestImages={false}
        />
        {/* Figma 2714-12566: 제목은 카드 바깥. 업로드 UI(추가 칸·삭제)는 백엔드에 기능이 없어 보기 전용 (#104) */}
        <Section title="현장 사진">
          <InfoCard testID="site-photo-card" style={styles.sitePhotoCard}>
            <InfoField label="주소" value={work.address} />
            <View style={styles.sitePhotos}>
              {work.requestImages.map(uri => (
                <PhotoThumb key={uri} uri={uri} variant="site" />
              ))}
            </View>
          </InfoCard>
        </Section>
      </ScrollView>
      <View style={[readableColumn, styles.actions]}>
        <CTA
          size="M"
          variant="outline"
          label="거절"
          onPress={onReject}
          disabled={accepting}
          style={styles.action}
        />
        <CTA
          size="M"
          label="수락"
          onPress={accept}
          disabled={accepting}
          style={styles.action}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  header: { height: 56, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: 20 },
  content: { paddingBottom: 24 },
  sitePhotoCard: { gap: 16 },
  sitePhotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  action: { flex: 1 },
});
