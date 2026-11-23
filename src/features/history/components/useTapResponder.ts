import { useLayoutEffect, useRef, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';

/** 이만큼(pt) 넘게 움직이면 누르기가 아니라 밀기다 */
const TAP_SLOP = 10;

/**
 * 날짜 선택 상자(#203)의 누르는 자리들(상자 바깥·상자 안·머리 글자·휠 열)이 쓰는 응답자.
 * 닿자마자 응답자가 되고 놓아 주지 않는다: 열린 동안 바깥의 탭 밀기(#217 덮기)·월 밀기가 터치를 가져가지 못한다.
 * 제자리에서 누르고 뗐을 때만 onTap 을 부른다 (민 것은 누르기가 아니다). locate 로 닿은 자리를 함께 넘길 수 있다.
 * 휠 열의 네이티브 스크롤은 JS 응답자와 상관없이 돈다
 */
export function useTapResponder<P>({
  onTap,
  locate,
}: {
  onTap: (point: P | null) => void;
  locate?: (event: GestureResponderEvent) => P | null;
}) {
  const latest = useRef({ onTap, locate });
  useLayoutEffect(() => {
    latest.current = { onTap, locate };
  });
  const [handlers] = useState(() => {
    let start: { x: number; y: number; point: P | null } | null = null;
    return {
      onTouchStart: (event: GestureResponderEvent) => {
        const { pageX, pageY } = event.nativeEvent;
        start = {
          x: pageX,
          y: pageY,
          point: latest.current.locate?.(event) ?? null,
        };
      },
      onStartShouldSetResponder: () => true,
      onResponderTerminationRequest: () => false,
      onResponderTerminate: () => {
        start = null;
      },
      onResponderRelease: (event: GestureResponderEvent) => {
        const touched = start;
        start = null;
        if (touched === null) {
          return;
        }
        const { pageX, pageY } = event.nativeEvent;
        if (Math.hypot(pageX - touched.x, pageY - touched.y) <= TAP_SLOP) {
          latest.current.onTap(touched.point);
        }
      },
    };
  });
  return handlers;
}
