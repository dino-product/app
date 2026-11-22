import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, CTA, Icon, withOpacity } from '../design-system';
import { useReduceMotion } from '../accessibility/useReduceMotion';
import { anchorAnimation, fadeFollowing } from './jumpAnchorMotion';
import { readableColumn } from './readableColumn';

// 아래쪽에 떠 있는 바로가기 버튼(앵커)과 그 뒤 그라데이션. 누르면 쓰는 화면이 그 자리로 스크롤한다.
// 작업 상세 '완료 보고 작성하기'(#95) 로 처음 만들었고, 가입 약관 상세 '약관 동의하기'(#218) 가 같은 모양으로 쓴다.
// 보이고 숨을 때 카툰처럼 움직인다 (#149, jumpAnchorMotion).
// 숨는 애니메이션 동안에도 그려야 해서 visible 과 따로 mounted 를 둔다. 숨기 시작하면 바로 누를 수 없고 스크린리더에서도 숨는다.
// 처음 그릴 때는 애니메이션 없이 제자리다. 동작 줄이기면 애니메이션 없이 바로 보이고 숨는다.
// 그라데이션은 버튼과 함께 내려가고 올라오지만 제자리보다 위로는 가지 않는다 (아래 끝이 들려 틈이 보이지 않게)
export function JumpAnchor({
  label,
  accessibilityLabel,
  visible,
  onPress,
  bottomInset = 0,
  testID,
}: {
  /** 버튼 글자 */
  label: string;
  /** 스크린리더 이름 (없으면 label) */
  accessibilityLabel?: string;
  visible: boolean;
  onPress: () => void;
  /**
   * 화면 아래 끝에서 비켜 둘 거리. 하단 탭 없이 열리는 화면(가입 약관 상세)은 아래 안전 영역(홈 인디케이터)이다.
   * 버튼은 그만큼 올리고, 그라데이션은 모양을 그대로 둔 채 그만큼 아래로 늘린다
   */
  bottomInset?: number;
  /** 버튼 묶음의 testID. 그라데이션은 `${testID}-fade` */
  testID: string;
}) {
  const reduceMotion = useReduceMotion();
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) {
    setMounted(true);
  }
  // 제자리에서 아래로 내려간 거리. 숨은 자리는 그라데이션 높이만큼 아래(영역 밖)다
  const hidden = JUMP_FADE_HEIGHT + bottomInset;
  const [offset] = useState(() => new Animated.Value(visible ? 0 : hidden));
  // 렌더마다 새 노드를 만들지 않게 높이가 바뀔 때만 만든다
  const fadeOffset = useMemo(
    () => fadeFollowing(offset, hidden),
    [offset, hidden],
  );
  const sized = useMemo(
    () => (bottomInset === 0 ? tabBarSized : sizedStyles(bottomInset)),
    [bottomInset],
  );
  // 마지막으로 다 움직여 멈춘 상태와 지금 움직이는 중인지. 반대로 바뀌면 지금 자리에서 이어 간다
  const settled = useRef(visible);
  const moving = useRef(false);

  useEffect(() => {
    if (!mounted) {
      // 숨어 있는 동안 아래 거리(안전 영역)가 바뀌면 새 숨은 자리에서 올라오게 옮겨 둔다
      offset.setValue(hidden);
      return;
    }
    if (!moving.current && settled.current === visible) {
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
      offset.setValue(visible ? 0 : hidden);
      settle();
      return;
    }
    const animation = anchorAnimation(offset, visible, hidden, moving.current);
    moving.current = true;
    // 도중에 멈춘 애니메이션은 finished: false 로 끝나 마무리(숨었으면 내리기)를 하지 않는다
    animation.start(({ finished }) => {
      if (finished) {
        settle();
      }
    });
    // 반대로 바뀌거나 화면을 떠나면(언마운트) 멈춘다
    return () => animation.stop();
  }, [visible, mounted, offset, hidden, reduceMotion]);

  if (!mounted) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={[styles.area, sized.area]}>
      {/* 버튼 뒤 그라데이션 (#95). 터치는 아래 스크롤 뷰로 넘기고, 스크린리더에서 숨긴다 */}
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.fade,
          sized.fade,
          {
            transform: [{ translateY: fadeOffset }],
          },
        ]}
        testID={`${testID}-fade`}
      />
      {/* 버튼 양옆 여백까지 덮으므로 그 터치는 아래 스크롤 뷰로 넘긴다. 숨는 중에는 누를 수 없고 스크린리더에서도 숨는다 */}
      <Animated.View
        pointerEvents={visible ? 'box-none' : 'none'}
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
        style={[
          readableColumn,
          styles.jump,
          sized.jump,
          { transform: [{ translateY: offset }] },
        ]}
        testID={testID}
      >
        <CTA
          variant="brand"
          icon={
            <Icon name="chevrons-down" size={20} color={colors.white[100]} />
          }
          label={label}
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
        />
      </Animated.View>
    </View>
  );
}

// 버튼 뒤 그라데이션. Figma 작업수행-상세 (2741:2713) 의 Frame 2147238742 (2741:3417):
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
/** 버튼이 그라데이션 아래 끝(탭 바 위 또는 안전 영역 위)에서 떨어진 거리 */
const JUMP_BOTTOM = 16;
/** 높이 height 인 그라데이션에서 위에서 잰 거리의 비율 */
const fadeStop = (fromTop: number, height: number) =>
  `${Math.round((fromTop / height) * 10000) / 100}%`;

/**
 * 아래에서 비켜 둘 거리에 따라 정해지는 크기. 그라데이션 모양(위에서 잰 투명 구간 끝·불투명 시작)은 그대로이고
 * 늘린 만큼 아래가 불투명이다
 */
function sizedStyles(bottomInset: number) {
  const height = JUMP_FADE_HEIGHT + bottomInset;
  return StyleSheet.create({
    area: { height },
    jump: { bottom: JUMP_BOTTOM + bottomInset },
    fade: {
      height,
      backgroundImage: `linear-gradient(to bottom, ${withOpacity(
        JUMP_FADE_COLOR,
        0,
      )} ${fadeStop(JUMP_FADE_CLEAR_UNTIL, height)}, ${withOpacity(
        JUMP_FADE_COLOR,
        1,
      )} ${fadeStop(JUMP_FADE_SOLID_FROM, height)})`,
    },
  });
}

/** 하단 탭 바 위에 붙는 화면(작업 상세) */
const tabBarSized = sizedStyles(0);

const styles = StyleSheet.create({
  // 그라데이션 높이만큼 창 아래에 깔고, 숨으며 내려간 버튼·그라데이션이 탭 바 위로 비치지 않게 자른다
  area: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  // 좌우를 정하지 않아 alignSelf 로 가운데에 놓인다
  jump: { position: 'absolute', paddingHorizontal: 24 },
  // 창 폭 전체에 깔고 버튼과 함께 탭 바 위에 붙는다
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
});
