import { colors } from './colors';
import { pressedBackground } from './pressed';

// #102: 누를 수 있는 리스트 행·카드의 눌림 배경은 이 한 곳에서 정한다
describe('pressedBackground', () => {
  it('흰 바탕 행은 Gray50, 회색 바탕 행은 한 단계 진한 Gray100 이다', () => {
    expect(pressedBackground).toEqual({
      onWhite: colors.gray[50],
      onGray: colors.gray[100],
    });
  });
});
