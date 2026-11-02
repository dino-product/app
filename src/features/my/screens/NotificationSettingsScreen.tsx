import type { Ref } from 'react';
import { ScrollView, StyleSheet, View, type TextInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, Text, Toggle } from '../../../shared/design-system';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { SubScreenHeader } from '../components/SubScreenHeader';
import type { NotificationSettings } from '../model';

// Figma 마이페이지-알림설정 (2889:13774 모두 켬 / 2889:13608 모두 끔). 저장 버튼 없이 바로 반영한다
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
  settings,
  onChange,
  onBack,
  titleRef,
}: {
  settings: NotificationSettings;
  onChange: (key: keyof NotificationSettings, value: boolean) => void;
  onBack: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SubScreenHeader title="알림 설정" onBack={onBack} titleRef={titleRef} />
      <ScrollView contentContainerStyle={[readableColumn, styles.content]}>
        {items.map(item => (
          <View key={item.key} style={styles.card}>
            <View style={styles.text}>
              <Text variant="Body/S/SemiBold">{item.title}</Text>
              <Text variant="Caption/M/Medium" color={colors.gray[600]}>
                {item.description}
              </Text>
            </View>
            {/* 스크린리더는 "작업 배정 알림, 스위치, 켬" 으로 읽는다 */}
            <Toggle
              value={settings[item.key]}
              onValueChange={value => onChange(item.key, value)}
              accessibilityLabel={item.title}
            />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

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
