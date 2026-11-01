import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text, View, type Insets } from 'react-native';
import {
  expectMinTouchTarget,
  hitSlopOf,
  MIN_FONT_SCALE,
  MIN_TOUCH_TARGET,
  minLineHeight,
  stylePt,
} from './touchTarget';

const renderBox = (hitSlop?: number | Insets) =>
  render(<View testID="box" hitSlop={hitSlop} style={styles.box} />);

describe('touchTarget', () => {
  it('숫자 hitSlop 은 네 변에 같은 값으로 푼다', async () => {
    await renderBox(2);

    expect(hitSlopOf(screen.getByTestId('box'))).toEqual({
      top: 2,
      bottom: 2,
      left: 2,
      right: 2,
    });
  });

  it('빠진 변과 hitSlop 이 없는 경우는 0 이다', async () => {
    await renderBox({ top: 1 });
    expect(hitSlopOf(screen.getByTestId('box'))).toEqual({
      top: 1,
      bottom: 0,
      left: 0,
      right: 0,
    });

    await renderBox();
    expect(hitSlopOf(screen.getByTestId('box'))).toEqual({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
  });

  it('펼친 스타일의 pt 값을 읽고, 없는 값은 0, 숫자가 아니면 에러다', async () => {
    await renderBox();
    const box = screen.getByTestId('box');

    expect(stylePt(box, 'width')).toBe(40);
    expect(stylePt(box, 'paddingTop')).toBe(0);
    expect(() => stylePt(box, 'height')).toThrow('height 가 pt 숫자가 아니다');
  });

  it('크기와 hitSlop 의 합이 최소 터치 영역 이상이면 통과하고, 모자라면 축과 내역을 알린다', async () => {
    await renderBox({ top: 2, bottom: 2, left: 1, right: 1 });
    const box = screen.getByTestId('box');
    const size = MIN_TOUCH_TARGET - 4;

    expectMinTouchTarget(box, { height: size });
    expect(() =>
      expectMinTouchTarget(box, { width: size, height: size }),
    ).toThrow(
      `터치 영역 width ${size + 2} 가 ${MIN_TOUCH_TARGET} 보다 작다 ` +
        `(크기 ${size} + hitSlop 1 + 1)`,
    );
  });

  it('가장 작은 글자 설정의 한 줄 높이를 계산한다', async () => {
    await render(
      <Text testID="label" style={styles.label}>
        라벨
      </Text>,
    );

    expect(minLineHeight(screen.getByTestId('label'))).toBeCloseTo(
      20 * MIN_FONT_SCALE,
    );
  });
});

const styles = StyleSheet.create({
  box: { width: 40, height: '100%' },
  label: { lineHeight: 20 },
});
