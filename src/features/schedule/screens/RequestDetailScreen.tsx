import type { Ref } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, CTA, Icon, Text } from '../../../shared/design-system';
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
  onAccept: () => void;
  /** 거절 사유 화면으로 */
  onReject: () => void;
  onCall: (phone: string) => void;
  onNavigate: (address: string) => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={10}
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
      <ScrollView contentContainerStyle={styles.content}>
        <WorkInfoSections work={work} onCall={onCall} onNavigate={onNavigate} />
      </ScrollView>
      <View style={styles.actions}>
        <CTA
          size="M"
          variant="outline"
          label="거절"
          onPress={onReject}
          style={styles.action}
        />
        <CTA size="M" label="수락" onPress={onAccept} style={styles.action} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  header: { height: 56, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: 20 },
  content: { paddingBottom: 24 },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  action: { flex: 1 },
});
