import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, CTA, Icon, withOpacity } from '../../../shared/design-system';
import { useReduceMotion } from '../../../shared/accessibility/useReduceMotion';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { anchorAnimation, fadeFollowing } from './reportAnchorMotion';

// '완료 보고 작성하기' 떠 있는 버튼(앵커)과 그 뒤 그라데이션 (#95). 보이고 숨을 때 카툰처럼 움직인다 (#149, reportAnchorMotion).
// 숨는 애니메이션 동안에도 그려야 해서 visible 과 따로 mounted 를 둔다. 숨기 시작하면 바로 누를 수 없고 스크린리더에서도 숨는다.
// 처음 그릴 때는 애니메이션 없이 제자리다. 동작 줄이기면 애니메이션 없이 바로 보이고 숨는다.
// 그라데이션은 버튼과 함께 내려가고 올라오지만 제자리보다 위로는 가지 않는다 (아래 끝이 들려 틈이 보이지 않게)
export function ReportJumpAnchor({
  visible,
  onPress,
}: {
  visible: boolean;
  onPress: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) {
    setMounted(true);
  }
  // 제자리에서 아래로 내려간 거리. 숨은 자리는 그라데이션 높이만큼 아래(영역 밖)다
  const [offset] = useState(
    () => new Animated.Value(visible ? 0 : JUMP_FADE_HEIGHT),
  );
  // 렌더마다 새 노드를 만들지 않게 한 번만 만든다
  const [fadeOffset] = useState(() => fadeFollowing(offset, JUMP_FADE_HEIGHT));
  // 마지막으로 다 움직여 멈춘 상태와 지금 움직이는 중인지. 반대로 바뀌면 지금 자리에서 이어 간다
  const settled = useRef(visible);
  const moving = useRef(false);

  useEffect(() => {
    if (!mounted || (!moving.current && settled.current === visible)) {
      return;
    }
    const settle = () => {
      moving.current = false;
      settled.current = visible;
      if (!visible) {
        setMounted(false);
      }
    };
    if (reduceMotion.current) {
      offset.setValue(visible ? 0 : JUMP_FADE_HEIGHT);
      settle();
      return;
    }
    const animation = anchorAnimation(
      offset,
      visible,
      JUMP_FADE_HEIGHT,
      moving.current,
    );
    moving.current = true;
    // 도중에 멈춘 애니메이션은 finished: false 로 끝나 마무리(숨었으면 내리기)를 하지 않는다
    animation.start(({ finished }) => {
      if (finished) {
        settle();
      }
    });
    // 반대로 바뀌거나 화면을 떠나면(언마운트) 멈춘다
    return () => animation.stop();
  }, [visible, mounted, offset, reduceMotion]);

  if (!mounted) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.area}>
      {/* 버튼 뒤 그라데이션 (#95). 터치는 아래 스크롤 뷰로 넘기고, 스크린리더에서 숨긴다 */}
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.fade,
          {
            transform: [{ translateY: fadeOffset }],
          },
        ]}
        testID="work-detail-jump-fade"
      />
      {/* 버튼 양옆 여백까지 덮으므로 그 터치는 아래 스크롤 뷰로 넘긴다. 숨는 중에는 누를 수 없고 스크린리더에서도 숨는다 */}
      <Animated.View
        pointerEvents={visible ? 'box-none' : 'none'}
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
        style={[
          readableColumn,
          styles.jump,
          { transform: [{ translateY: offset }] },
        ]}
        testID="work-detail-jump"
      >
        <CTA
          variant="brand"
          icon={
            <Icon name="chevrons-down" size={20} color={colors.white[100]} />
          }
          label="완료 보고 작성하기"
          onPress={onPress}
        />
      </Animated.View>
    </View>
  );
}

// '완료 보고 작성하기' 뒤 그라데이션. Figma 작업수행-상세 (2741:2713) 의 Frame 2147238742 (2741:3417):
// 393×320, 프레임 위 532 에서 아래 끝(852)까지, 채움 #F0F0F0 (변수 없음) 투명 0% → 불투명 54.3%, 위→아래.
// 변환 행렬(위치 = 1.065 × 높이 비율 − 0.065)로 레이어 높이의 6.1% 까지 투명, 57.1% 부터 불투명이다.
// 앱 화면은 탭 바(Figma 102) 위에서 끝나므로 그 위로 보이는 218 만 그리고, 정지점은 레이어 위에서 잰 거리로 옮긴다
const JUMP_FADE_COLOR = '#F0F0F0';
const FIGMA_FADE_HEIGHT = 320;
const FIGMA_TAB_BAR_HEIGHT = 102;
const JUMP_FADE_HEIGHT = FIGMA_FADE_HEIGHT - FIGMA_TAB_BAR_HEIGHT;
/** Figma 레이어 위에서 잰 투명 구간 끝 / 불투명 시작 (pt) */
const JUMP_FADE_CLEAR_UNTIL = (FIGMA_FADE_HEIGHT * 0.065) / 1.065;
const JUMP_FADE_SOLID_FROM = (FIGMA_FADE_HEIGHT * (0.5432692 + 0.065)) / 1.065;
const fadeStop = (fromTop: number) =>
  `${Math.round((fromTop / JUMP_FADE_HEIGHT) * 10000) / 100}%`;

const styles = StyleSheet.create({
  // 그라데이션 높이만큼 창 아래에 깔고, 숨으며 내려간 버튼·그라데이션이 탭 바 위로 비치지 않게 자른다
  area: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: JUMP_FADE_HEIGHT,
    overflow: 'hidden',
  },
  // 좌우를 정하지 않아 alignSelf 로 가운데에 놓인다
  jump: { position: 'absolute', bottom: 16, paddingHorizontal: 24 },
  // 창 폭 전체에 깔고 버튼과 함께 탭 바 위에 붙는다
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: JUMP_FADE_HEIGHT,
    pointerEvents: 'none',
    backgroundImage: `linear-gradient(to bottom, ${withOpacity(
      JUMP_FADE_COLOR,
      0,
    )} ${fadeStop(JUMP_FADE_CLEAR_UNTIL)}, ${withOpacity(
      JUMP_FADE_COLOR,
      1,
    )} ${fadeStop(JUMP_FADE_SOLID_FROM)})`,
  },
});
