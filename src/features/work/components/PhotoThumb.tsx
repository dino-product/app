import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../../../shared/design-system';

// 목 데이터(mock://)와 열리지 않는 사진은 회색 자리로, 실제 URI 는 이미지로 그린다.
// 열리지 않는 사진: 이어 쓰기(#34)로 복원했는데 촬영·앨범의 임시 파일을 OS 가 지운 경우 등
export function PhotoThumb({ uri }: { uri: string }) {
  // 열리지 않은 URI 를 기억한다. 사진 목록은 위치를 key 로 써서 앞 사진을 지우면 이 자리에 다음 사진이 온다
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (uri.startsWith('mock://') || uri === failedUri) {
    return (
      <View testID="photo-thumb" style={[styles.thumb, styles.placeholder]} />
    );
  }
  return (
    <Image
      testID="photo-thumb"
      source={{ uri }}
      style={styles.thumb}
      onError={() => setFailedUri(uri)}
    />
  );
}

export const THUMB_SIZE = 88;

const styles = StyleSheet.create({
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 8 },
  placeholder: { backgroundColor: colors.gray[200] },
});
