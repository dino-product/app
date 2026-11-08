import { render, screen } from '@testing-library/react-native';
import { colors, typography } from '../../../shared/design-system';
import { SummaryCard } from './SummaryCard';

// Figma 작업이력 (기본) 3753:4890 › 요약 카드 3753:4903 (#145)
describe('SummaryCard', () => {
  it('강조 카드(이번 달 완료 3753:4907)는 Primary 배경에 숫자 White/100%, 설명 White/60% 다', async () => {
    await render(<SummaryCard label="이번 달 완료" count={18} emphasis />);

    expect(screen.getByLabelText('이번 달 완료 18건')).toHaveStyle({
      backgroundColor: colors.primary,
    });
    expect(screen.getByText('18건')).toHaveStyle({
      ...typography['Body/L/Bold'],
      color: colors.white[100],
    });
    expect(screen.getByText('이번 달 완료')).toHaveStyle({
      ...typography['Body/XS/Medium'],
      color: colors.white[60],
    });
  });

  it('기본 카드(누적 완료 3753:4904)는 숫자 Gray700, 설명 Gray600 이다', async () => {
    await render(<SummaryCard label="누적 완료" count={132} />);

    expect(screen.getByText('132건')).toHaveStyle({
      ...typography['Body/L/Bold'],
      color: colors.gray[700],
    });
    expect(screen.getByText('누적 완료')).toHaveStyle({
      ...typography['Body/XS/Medium'],
      color: colors.gray[600],
    });
  });

  it('두 카드 모두 모서리 16, 왼쪽 20 · 오른쪽 46 · 위아래 20, 숫자와 설명 사이 4 다', async () => {
    await render(
      <>
        <SummaryCard label="이번 달 완료" count={18} emphasis />
        <SummaryCard label="누적 완료" count={132} />
      </>,
    );

    for (const label of ['이번 달 완료 18건', '누적 완료 132건']) {
      expect(screen.getByLabelText(label)).toHaveStyle({
        borderRadius: 16,
        paddingLeft: 20,
        paddingRight: 46,
        paddingVertical: 20,
        gap: 4,
      });
    }
  });

  it('수를 모르면 강조 카드도 "-" 이고 "알 수 없음" 으로 읽는다', async () => {
    await render(<SummaryCard label="이번 달 완료" count={null} emphasis />);

    expect(screen.getByLabelText('이번 달 완료, 알 수 없음')).toBeOnTheScreen();
    expect(screen.getByText('-')).toHaveStyle({ color: colors.white[100] });
  });
});
