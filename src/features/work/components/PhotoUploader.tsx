import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  colors,
  Icon,
  MIN_TOUCH_TARGET,
  Text,
} from '../../../shared/design-system';
import { PHOTO_LIMIT } from '../model';
import { PhotoThumb, THUMB_SIZE } from './PhotoThumb';

// 현장 사진 등록 (작업 전 / 작업 후). 촬영·앨범 연동은 onAdd 를 넘기는 쪽에서 한다.
// Figma 작업수행-상세/보고제출 활성 (3235:16226·3235:15926): 카드 없이 이름(Caption/M/Medium Gray600) 아래 8 에
// 사진 줄. 줄은 가로로 넘쳐 옆으로 밀어 보고(3235:16332 폭 565), 칸은 105×105·모서리 8, 칸 사이 10.
// readOnly 는 제출을 마친 보고다. Figma 제출 후 화면에도 추가 칸·삭제 버튼이 있어 숨기지 않고 누를 수만 없게 한다
export function PhotoUploader({
  title,
  photos,
  onAdd,
  onRemove,
  readOnly = false,
}: {
  title: string;
  photos: readonly string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  readOnly?: boolean;
}) {
  const addDisabled = readOnly || photos.length >= PHOTO_LIMIT;

  return (
    <View style={styles.group}>
      <Text variant="Caption/M/Medium" color={colors.gray[600]}>
        {title}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        testID={`photo-row-${title}`}
        contentContainerStyle={styles.row}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title} 사진 추가`}
          accessibilityState={{ disabled: addDisabled }}
          accessibilityValue={{ text: `${photos.length}/${PHOTO_LIMIT}` }}
          disabled={addDisabled}
          onPress={onAdd}
          style={styles.addTile}
        >
          {/* Figma Iconly Camera 30·Gray400 (아이콘 기본값) 아래 1 에 장수 */}
          <Icon name="camera" testID="add-photo-icon" />
          <Text variant="Caption/S/Medium" color={colors.gray[600]}>
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
              accessibilityState={{ disabled: readOnly }}
              disabled={readOnly}
              hitSlop={REMOVE_HIT_SLOP}
              onPress={() => onRemove(index)}
              style={styles.remove}
            >
              <Icon name="close" size={REMOVE_SIZE} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// Figma 3235:16353: 지우기 x(24) 는 칸 위·오른쪽 7
const REMOVE_SIZE = 24;
const REMOVE_INSET = 7;
// 24 닫기 아이콘을 최소 터치 영역(iOS 44, Android 48)으로 넓힌다. 사진 줄은 가로 스크롤이라 줄 밖으로 넓힌 곳은 잘리므로
// 위·오른쪽은 칸 가장자리(7)까지만, 나머지는 칸 안쪽(왼쪽·아래)으로 넓힌다
const REMOVE_INNER_SLOP = MIN_TOUCH_TARGET - REMOVE_SIZE - REMOVE_INSET;
const REMOVE_HIT_SLOP = {
  top: REMOVE_INSET,
  right: REMOVE_INSET,
  bottom: REMOVE_INNER_SLOP,
  left: REMOVE_INNER_SLOP,
};

const styles = StyleSheet.create({
  group: { gap: 8 },
  row: { gap: 10 },
  addTile: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    borderRadius: 8,
    backgroundColor: colors.gray[50],
  },
  remove: { position: 'absolute', top: REMOVE_INSET, right: REMOVE_INSET },
});
