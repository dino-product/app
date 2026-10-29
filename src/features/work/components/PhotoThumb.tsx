import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../../../shared/design-system';

// 목 데이터(mock://)는 회색 자리로, 실제 URI 는 이미지로 그린다.
export function PhotoThumb({ uri }: { uri: string }) {
  if (uri.startsWith('mock://')) {
    return <View style={[styles.thumb, styles.placeholder]} />;
  }
  return <Image source={{ uri }} style={styles.thumb} />;
}

export const THUMB_SIZE = 88;

const styles = StyleSheet.create({
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 8 },
  placeholder: { backgroundColor: colors.gray[200] },
});
