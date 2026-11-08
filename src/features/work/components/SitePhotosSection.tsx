import { StyleSheet, View } from 'react-native';
import { colors, Text } from '../../../shared/design-system';
import { InfoCard, InfoField, Section } from './InfoCard';
import { PhotoThumb } from './PhotoThumb';

// 작업 상세의 현장 사진: 작업을 등록할 때 함께 온 작업 요청 사진(백엔드 sitePhotos, "등록·수정 때 붙인 현장 사진").
// 모든 작업 상세(홈·알림·작업 이력의 작업 상세, 내 일정의 요청 상세)가 WorkInfoSections 를 거쳐 이 섹션 하나를 쓴다 (#142).
// Figma 2714:12566: 제목은 카드 바깥, 카드 안에 주소 줄과 110 사진 칸.
// 추가 칸·삭제는 기사가 요청 사진을 바꾸는 기능이 백엔드에 없어 그리지 않는다(보기 전용, #104)
export function SitePhotosSection({
  address,
  photos,
}: {
  address: string;
  photos: readonly string[];
}) {
  return (
    <Section title="현장 사진">
      <InfoCard testID="site-photo-card" style={styles.card}>
        <InfoField label="주소" value={address} />
        {photos.length > 0 ? (
          // 썸네일은 누를 수 없는 그림이라 스크린리더는 묶음 하나로 장수를 읽는다
          <View
            accessible
            accessibilityLabel={`현장 사진 ${photos.length}장`}
            style={styles.photos}
          >
            {photos.map(uri => (
              <PhotoThumb key={uri} uri={uri} variant="site" />
            ))}
          </View>
        ) : (
          // Figma 에 빈 상태가 없어 일정 목록의 빈 문구와 같은 글자로 둔 기본안이다 (Figma 미확인)
          <Text variant="Body/XS/Medium" color={colors.gray[500]}>
            등록된 현장 사진이 없습니다
          </Text>
        )}
      </InfoCard>
    </Section>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
