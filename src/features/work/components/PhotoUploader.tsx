import { Pressable, StyleSheet, View } from 'react-native';
import { colors, Icon, Text } from '../../../shared/design-system';
import { PHOTO_LIMIT } from '../model';
import { InfoCard } from './InfoCard';
import { PhotoThumb, THUMB_SIZE } from './PhotoThumb';

// 현장 사진 등록 (작업 전 / 작업 후). 촬영·앨범 연동은 onAdd 를 넘기는 쪽에서 한다.
// disabled 는 제출을 마친 보고다. Figma 제출 후 화면에도 추가 칸·삭제 버튼이 있어 숨기지 않고 누를 수만 없게 한다
export function PhotoUploader({
  title,
  photos,
  onAdd,
  onRemove,
  disabled = false,
}: {
  title: string;
  photos: readonly string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}) {
  const addDisabled = disabled || photos.length >= PHOTO_LIMIT;

  return (
    <InfoCard style={styles.card}>
      <Text variant="Caption/M/SemiBold">{title}</Text>
      <View style={styles.grid}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title} 사진 추가`}
          accessibilityState={{ disabled: addDisabled }}
          accessibilityValue={{ text: `${photos.length}/${PHOTO_LIMIT}` }}
          disabled={addDisabled}
          onPress={onAdd}
          style={styles.addTile}
        >
          <Icon name="camera" size={20} color={colors.gray[500]} />
          <Text variant="Caption/S/Medium" color={colors.gray[500]}>
            {`${photos.length}/${PHOTO_LIMIT}`}
          </Text>
        </Pressable>
        {photos.map((uri, index) => (
          // 같은 사진을 두 번 고를 수 있어 위치를 key 로 쓴다
          <View key={index}>
            <PhotoThumb uri={uri} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${title} 사진 ${index + 1} 삭제`}
              accessibilityState={{ disabled }}
              disabled={disabled}
              hitSlop={REMOVE_HIT_SLOP}
              onPress={() => onRemove(index)}
              style={styles.remove}
            >
              <Icon name="close" size={24} />
            </Pressable>
          </View>
        ))}
      </View>
    </InfoCard>
  );
}

// 24 닫기 아이콘을 48 로 넓힌다. 두 플랫폼의 최소 터치 영역(iOS 44, Android 48) 이상이다
const REMOVE_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

const styles = StyleSheet.create({
  card: { gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  addTile: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 8,
    backgroundColor: colors.gray[50],
  },
  remove: { position: 'absolute', top: 4, right: 4 },
});
