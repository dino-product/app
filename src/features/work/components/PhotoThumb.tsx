import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../../../shared/design-system';

// 목 데이터(mock://)·서버의 가짜 사진 주소(fake-photo://, #112 G4)와 열리지 않는 사진은 회색 자리로, 실제 URI 는 이미지로 그린다.
// 열리지 않는 사진: 이어 쓰기(#34)로 복원했는데 촬영·앨범의 임시 파일을 OS 가 지운 경우 등
const PLACEHOLDER_SCHEMES = ['mock://', 'fake-photo://'];

// site 는 작업 상세의 현장 사진(작업 요청 사진) 칸이다 (Figma 2714-12573: 110×110, 모서리 10). default 는 완료 보고 사진 칸
export function PhotoThumb({
  uri,
  variant = 'default',
}: {
  uri: string;
  variant?: 'default' | 'site';
}) {
  const size = variant === 'site' ? styles.siteThumb : styles.thumb;
  // 열리지 않은 URI 를 기억한다. 사진 목록은 위치를 key 로 써서 앞 사진을 지우면 이 자리에 다음 사진이 온다
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (
    PLACEHOLDER_SCHEMES.some(scheme => uri.startsWith(scheme)) ||
    uri === failedUri
  ) {
    return <View testID="photo-thumb" style={[size, styles.placeholder]} />;
  }
  return (
    <Image
      testID="photo-thumb"
      source={{ uri }}
      style={size}
      onError={() => setFailedUri(uri)}
    />
  );
}

// 완료 보고 사진 칸: Figma 작업수행-상세/보고제출 활성 (3235:16335 등) 105×105, 모서리 8 (#180)
export const THUMB_SIZE = 105;
const SITE_THUMB_SIZE = 110;

const styles = StyleSheet.create({
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 8 },
  siteThumb: {
    width: SITE_THUMB_SIZE,
    height: SITE_THUMB_SIZE,
    borderRadius: 10,
  },
  placeholder: { backgroundColor: colors.gray[200] },
});
