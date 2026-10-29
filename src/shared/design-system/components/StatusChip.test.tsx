import { render, screen } from '@testing-library/react-native';
import { colors } from '../tokens/colors';
import { typography } from '../tokens/typography';
import { StatusChip, type WorkStatus } from './StatusChip';

describe('StatusChip', () => {
  it.each<[WorkStatus, string, string, string]>([
    ['registered', '등록', colors.registered[2], colors.registered[1]],
    ['assigned', '배정됨', colors.pending[3], colors.pending[1]],
    ['beforeWork', '작업전', colors.accepted[2], colors.accepted[1]],
    ['inProgress', '작업중', colors.inProgress[4], colors.inProgress[5]],
    ['completed', '완료', colors.completed[2], colors.completed[1]],
    ['rejected', '거절', colors.warning[2], colors.warning[1]],
    ['delayed', '지연', colors.delayed[2], colors.delayed[1]],
  ])('%s 는 "%s" 라벨과 상태 색을 쓴다', async (status, label, bg, fg) => {
    await render(<StatusChip status={status} testID="chip" />);

    expect(screen.getByTestId('chip')).toHaveStyle({ backgroundColor: bg });
    expect(screen.getByText(label)).toHaveStyle({ color: fg });
  });

  // 글꼴 크기를 키운 사용자에게 글자가 잘리지 않도록 높이는 최소값으로만 건다
  it('기본 크기 M 은 최소 높이 30, Body/XS/Medium 이다', async () => {
    await render(<StatusChip status="completed" testID="chip" />);

    expect(screen.getByTestId('chip')).toHaveStyle({ minHeight: 30 });
    expect(screen.getByTestId('chip')).not.toHaveStyle({ height: 30 });
    expect(screen.getByText('완료')).toHaveStyle(typography['Body/XS/Medium']);
  });

  it('크기 S 는 최소 높이 28, Caption/M/SemiBold 이다', async () => {
    await render(<StatusChip status="completed" size="S" testID="chip" />);

    expect(screen.getByTestId('chip')).toHaveStyle({ minHeight: 28 });
    expect(screen.getByText('완료')).toHaveStyle(
      typography['Caption/M/SemiBold'],
    );
  });

  it('label 로 문구를 바꿀 수 있다', async () => {
    await render(<StatusChip status="inProgress" label="진행중" />);

    expect(screen.getByText('진행중')).toBeOnTheScreen();
  });
});
