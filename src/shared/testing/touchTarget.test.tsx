import { render, screen } from '@testing-library/react-native';
import { StyleSheet, View, type Insets } from 'react-native';
import { expectMinTouchTarget, hitSlopOf, stylePt } from './touchTarget';

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

  it('크기와 hitSlop 의 합이 44 이상이면 통과하고, 모자라면 실패한다', async () => {
    await renderBox({ top: 2, bottom: 2, left: 1, right: 1 });
    const box = screen.getByTestId('box');

    expectMinTouchTarget(box, { height: 40 });
    expect(() => expectMinTouchTarget(box, { width: 40 })).toThrow();
  });
});

const styles = StyleSheet.create({ box: { width: 40, height: '100%' } });
