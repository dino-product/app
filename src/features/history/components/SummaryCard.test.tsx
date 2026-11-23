import { render, screen } from '@testing-library/react-native';
import { colors, typography } from '../../../shared/design-system';
import { SummaryCard } from './SummaryCard';

// Figma 작업이력 (기본) 50929:14822 · 3753:4890 › 요약 카드 51083:18504 · 51083:18464 (#220).
// 예전 이번 달 완료의 Primary 강조(#145)는 최신 Figma 에서 빠졌다: 두 카드 모두 흰 바탕이다
describe('SummaryCard', () => {
  it.each([
    ['이번 달 완료', 18, '51083:18505'],
    ['누적 완료', 132, '51083:18508'],
  ])(
    '%s 카드는 흰 바탕(White/100)에 숫자 Body/L/Bold Gray800, 설명 Body/XS/Medium Gray600 이다 (%s, %s)',
    async (label, count) => {
      await render(<SummaryCard label={label} count={count} />);

      expect(screen.getByLabelText(`${label} ${count}건`)).toHaveStyle({
        backgroundColor: colors.white[100],
      });
      expect(screen.getByText(`${count}건`)).toHaveStyle({
        ...typography['Body/L/Bold'],
        color: colors.gray[800],
      });
      expect(screen.getByText(label)).toHaveStyle({
        ...typography['Body/XS/Medium'],
        color: colors.gray[600],
      });
    },
  );

  it('모서리 16, 왼쪽 20 · 오른쪽 46 · 위아래 20, 숫자와 설명 사이 4, 세로 가운데 정렬이다', async () => {
    await render(<SummaryCard label="누적 완료" count={132} />);

    expect(screen.getByLabelText('누적 완료 132건')).toHaveStyle({
      justifyContent: 'center',
      borderRadius: 16,
      paddingLeft: 20,
      paddingRight: 46,
      paddingVertical: 20,
      gap: 4,
    });
  });

  it('수를 모르면 "-" (Gray800) 이고 "알 수 없음" 으로 읽는다', async () => {
    await render(<SummaryCard label="이번 달 완료" count={null} />);

    expect(screen.getByLabelText('이번 달 완료, 알 수 없음')).toBeOnTheScreen();
    expect(screen.getByText('-')).toHaveStyle({ color: colors.gray[800] });
  });

  it('받는 동안 숫자 자리는 흰 카드 위의 회색 스켈레톤 막대다', async () => {
    await render(<SummaryCard label="이번 달 완료" count={null} loading />);

    expect(screen.getByLabelText('이번 달 완료, 불러오는 중')).toHaveStyle({
      backgroundColor: colors.white[100],
    });
    expect(
      screen.getByTestId('summary-count-line-bar', {
        includeHiddenElements: true,
      }),
    ).toHaveStyle({ backgroundColor: colors.gray[100] });
  });
});
