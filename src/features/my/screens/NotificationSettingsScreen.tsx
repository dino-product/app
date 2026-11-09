import { memo, type Ref } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, Text, Toggle } from '../../../shared/design-system';
import { LoadStateView } from '../../../shared/layout/LoadStateView';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { noOverscroll } from '../../../shared/layout/noOverscroll';
import { NotificationSettingsSkeleton } from '../components/MySkeletons';
import { SubScreenHeader } from '../components/SubScreenHeader';
import type { NotificationSettings } from '../model';
import { useNotificationSettings } from '../notificationQueries';

// Figma 마이페이지-알림설정 (2889:13774 모두 켬 / 2889:13608 모두 끔). 저장 버튼 없이 바로 반영한다.
// 토글은 서버 값이고(#117), 바꾸면 바로 보인 뒤 세 값 모두 저장한다. 실패하면 이전 값으로 돌리고 알린다.
// 로딩·오류(다시 시도)·저장 실패 안내는 Figma 에 없어 기존 컴포넌트로 둔 기본안이다 (Figma 미확인)
const items: readonly {
  key: keyof NotificationSettings;
  title: string;
  description: string;
}[] = [
  {
    key: 'workAssignmentEnabled',
    title: '작업 배정 알림',
    description: '새로운 작업이 배정되었을 때 알려드려요',
  },
  {
    key: 'scheduleChangeEnabled',
    title: '일정 변경 알림',
    description: '작업 일정이 변경되었을 때 알려드려요',
  },
  {
    key: 'workCancellationEnabled',
    title: '작업 취소 알림',
    description: '배정된 작업이 취소되었을 때 알려드려요',
  },
];

export function NotificationSettingsScreen({
  onBack,
  titleRef,
}: {
  onBack: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const { settings, status, refetch, change } =
    useNotificationSettings(alertSaveFailed);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SubScreenHeader title="알림 설정" onBack={onBack} titleRef={titleRef} />
      {settings === undefined ? (
        <LoadStateView
          state={
            status === 'error'
              ? {
                  status: 'error',
                  message: '알림 설정을 불러오지 못했어요',
                  onRetry: () => refetch(),
                }
              : { status: 'loading' }
          }
          skeleton={<NotificationSettingsSkeleton />}
        />
      ) : (
        <ScrollView
          {...noOverscroll}
          contentContainerStyle={[readableColumn, styles.content]}
        >
          {items.map(item => (
            <SettingCard
              key={item.key}
              item={item}
              value={settings[item.key]}
              onChange={change}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// 문구는 기본안이다 (Figma 미확인). 토글은 이미 이전 값으로 돌아가 있어 다시 누르면 된다
function alertSaveFailed() {
  Alert.alert('알림 설정을 저장하지 못했어요', '잠시 후 다시 시도해 주세요.');
}

// 제목·설명 글자는 스크린리더에서 빼고 스위치 하나로 읽는다: "작업 배정 알림, 스위치, 켬" + 힌트(설명)
const SettingCard = memo(function MySettingCard({
  item,
  value,
  onChange,
}: {
  item: (typeof items)[number];
  value: boolean;
  onChange: (key: keyof NotificationSettings, value: boolean) => void;
}) {
  return (
    <View style={styles.card}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.text}
      >
        <Text variant="Body/S/SemiBold">{item.title}</Text>
        <Text variant="Caption/M/Medium" color={colors.gray[600]}>
          {item.description}
        </Text>
      </View>
      <Toggle
        value={value}
        onValueChange={next => onChange(item.key, next)}
        accessibilityLabel={item.title}
        accessibilityHint={item.description}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  content: {
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderRadius: 16,
    backgroundColor: colors.background[3],
  },
  text: { flex: 1, gap: 4 },
});
