import { useMemo } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { colors } from '../../../shared/design-system';
import { readableColumn } from '../../../shared/layout/readableColumn';
import {
  BOX_INSET,
  BOX_PADDING,
  BOX_RADIUS,
  pickerBoxGeometry,
} from '../monthPicker';

// 날짜 선택 상자의 흰 바탕 (#203, Figma 50867:5275). 상단 바 안에서 제목 위·월 줄 아래 층에 그려,
// 월 글자(머리 글자)가 상자 위에 보이게 한다. 누르는 자리·휠은 화면이 바 위 층(MonthPickerOverlay)에 따로 둔다.
// 시안 A '글자 자리에서 펼쳐짐': 바탕은 월 글자 크기·자리(접힌 바면 접힌 글자)에서 상자 크기로 커진다.
// 모든 값은 열림 진행도·접힘 진행도에서 UI 스레드로 보간한다
export type MonthPickerBoxProps = {
  /** 열림 진행도 (0 닫힘 → 1 열림) */
  open: Animated.Value;
  /** 상단 바 접힘 진행도 (0 펼침 → 1 접힘). 접힌 월 글자는 0.9 배다 */
  fold: Animated.Value;
  /** 월 줄이 접힌 자리로 올라간 거리 (접힘 진행도 × 거리) */
  monthShift: Animated.AnimatedNode;
  /** 펼친 바 안 월 줄 자리 */
  monthRow: { y: number; height: number };
  /** 월 글자 폭 (잰 값) */
  titleWidth: Animated.Value;
  /** 상자 폭. 열 때마다 처음 프레임부터 맞게 상자를 치운 뒤에도 남겨 둔다 (여기서 잰다) */
  boxWidth: Animated.Value;
};

export function MonthPickerBox({
  open,
  fold,
  monthShift,
  monthRow,
  titleWidth,
  boxWidth,
}: MonthPickerBoxProps) {
  const geometry = pickerBoxGeometry(monthRow);
  const onLayout = (event: LayoutChangeEvent) => {
    boxWidth.setValue(event.nativeEvent.layout.width);
  };

  const slotStyle = useMemo(
    () => [styles.slot, { top: geometry.top, height: geometry.height }],
    [geometry.top, geometry.height],
  );
  const boxStyle = useMemo(() => {
    // 0 이면 다 열렸다. 시작 값 × (1 - 열림) + 열림 으로 보간해 끝 값이 정확히 1 · 0 이 되게 한다
    const closed = Animated.subtract(1, open);
    const textScale = fold.interpolate({
      inputRange: [0, 1],
      outputRange: [1, FOLDED_TEXT_SCALE],
    });
    const from = (start: Animated.AnimatedNode) =>
      Animated.add(Animated.multiply(start, closed), open);
    // 상자 가운데에서 머리 글자 가운데(상자 위 24 + 줄 높이 / 2, 접힌 바면 접힌 자리)까지
    const textCenter = BOX_PADDING + monthRow.height / 2 - geometry.height / 2;
    return [
      styles.box,
      {
        transform: [
          {
            translateY: Animated.multiply(
              Animated.add(textCenter, monthShift),
              closed,
            ),
          },
          {
            scaleX: from(
              Animated.multiply(
                Animated.divide(titleWidth, boxWidth),
                textScale,
              ),
            ),
          },
          {
            scaleY: from(
              Animated.multiply(monthRow.height / geometry.height, textScale),
            ),
          },
        ],
      },
    ];
  }, [
    open,
    fold,
    monthShift,
    titleWidth,
    boxWidth,
    monthRow.height,
    geometry.height,
  ]);

  return (
    <View style={slotStyle}>
      <View style={[readableColumn, styles.column]}>
        <Animated.View
          testID="work-history-month-picker-box"
          style={boxStyle}
          onLayout={onLayout}
        />
      </View>
    </View>
  );
}

/** 접힌 바의 월 글자 배율 (Body/M 20 → Body/S 18) */
const FOLDED_TEXT_SCALE = 18 / 20;

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    left: 0,
    right: 0,
    pointerEvents: 'none',
  },
  column: { flex: 1, paddingHorizontal: BOX_INSET },
  // Figma 50867:5275: White/100 · 반경 24.68 · 그림자 0 4.94 흐림 9.87 검정 6%. 배경을 어둡게 하지 않는다
  box: {
    flex: 1,
    borderRadius: BOX_RADIUS,
    backgroundColor: colors.white[100],
    boxShadow: '0px 4.94px 9.87px rgba(0, 0, 0, 0.06)',
  },
});
