import { StyleSheet, View } from 'react-native';
import { colors, Icon, Text } from '../../../../shared/design-system';

// 회색 안내 상자: 정보 아이콘(App Icon warning 18) + 안내 문구 (Figma 온보딩 승인 대기 3227:8824, 유형 변경 완료 3239:9100)
export function InfoNotice({ message }: { message: string }) {
  return (
    <View style={styles.box}>
      <Icon name="info-small" color={colors.gray[600]} />
      <Text
        variant="Caption/S/Medium"
        color={colors.gray[600]}
        style={styles.text}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.background[3],
  },
  text: { flex: 1 },
});
