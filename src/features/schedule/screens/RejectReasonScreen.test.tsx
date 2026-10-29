import { render, screen, userEvent } from '@testing-library/react-native';
import { colors } from '../../../shared/design-system';
import { RejectReasonScreen } from './RejectReasonScreen';

const renderReject = (
  overrides: Partial<Parameters<typeof RejectReasonScreen>[0]> = {},
) =>
  render(
    <RejectReasonScreen
      onBack={jest.fn()}
      onSubmit={jest.fn()}
      {...overrides}
    />,
  );

describe('RejectReasonScreen', () => {
  it('제목과 사유 선택지를 보여준다', async () => {
    await renderReject();

    expect(screen.getByRole('header', { name: '거절 사유' })).toBeOnTheScreen();
    expect(screen.getByText('작업을 거절할까요?')).toBeOnTheScreen();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('사유를 고르면 선택 상태와 강조 테두리가 된다', async () => {
    await renderReject();

    const option = screen.getByRole('radio', {
      name: '이미 다른 작업이 있습니다',
    });
    await userEvent.press(option);

    expect(option).toBeChecked();
    expect(option).toHaveStyle({ borderColor: colors.secondary });
  });

  it('사유를 고르지 않고 제출하면 안내하고 제출하지 않는다', async () => {
    const onSubmit = jest.fn();
    await renderReject({ onSubmit });

    await userEvent.press(screen.getByRole('button', { name: '거절 제출' }));

    expect(screen.getByText('거절 사유를 선택해 주세요.')).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('기타를 고르고 내용을 비우면 안내하고, 채우면 그 내용으로 제출한다', async () => {
    const onSubmit = jest.fn();
    await renderReject({ onSubmit });

    await userEvent.press(
      screen.getByRole('radio', { name: '기타 (직접 입력)' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '거절 제출' }));
    expect(screen.getByText('기타 사유를 입력해 주세요.')).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(
      screen.getByLabelText('기타 거절 사유 입력'),
      '개인 사정',
    );
    await userEvent.press(screen.getByRole('button', { name: '거절 제출' }));

    expect(onSubmit).toHaveBeenCalledWith('개인 사정');
  });

  it('선택지 사유로 제출하고, 취소·뒤로는 onBack 을 부른다', async () => {
    const onSubmit = jest.fn();
    const onBack = jest.fn();
    await renderReject({ onSubmit, onBack });

    await userEvent.press(
      screen.getByRole('radio', { name: '작업 위치가 너무 멉니다' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '거절 제출' }));
    await userEvent.press(screen.getByRole('button', { name: '취소' }));
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(onSubmit).toHaveBeenCalledWith('작업 위치가 너무 멉니다');
    expect(onBack).toHaveBeenCalledTimes(2);
  });
});
