import { render, screen, userEvent } from '@testing-library/react-native';
import { colors } from '../../../shared/design-system';
import { ResultModal } from './ResultModal';

describe('ResultModal', () => {
  it('제출 완료: 제목·안내·상태·제출 시간을 보여준다', async () => {
    await render(
      <ResultModal
        visible
        result={{ kind: 'submitted', at: '10.01 15:15' }}
        onConfirm={jest.fn()}
      />,
    );

    expect(screen.getByRole('header', { name: '제출 완료' })).toBeOnTheScreen();
    expect(screen.getByText('작업이 완료 처리되었습니다')).toBeOnTheScreen();
    expect(screen.getByText('완료')).toBeOnTheScreen();
    expect(screen.getByText('10.01 15:15')).toBeOnTheScreen();
  });

  it('작업 취소: 취소 사유를 Warning/1 로 강조한다', async () => {
    await render(
      <ResultModal
        visible
        result={{ kind: 'canceled', reason: '고객 요청', at: '10.01 15:15' }}
        onConfirm={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('header', { name: '작업이 취소되었습니다' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('등록 담당자가 이 작업을\n취소했습니다'),
    ).toBeOnTheScreen();
    expect(screen.getByText('고객 요청')).toHaveStyle({
      color: colors.warning[1],
    });
  });

  it('"메인 화면으로" 를 누르면 onConfirm 을 호출한다', async () => {
    const onConfirm = jest.fn();
    await render(
      <ResultModal
        visible
        result={{ kind: 'submitted', at: '10.01 15:15' }}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.press(
      screen.getByRole('button', { name: '메인 화면으로' }),
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('visible 이 false 면 아무것도 그리지 않는다', async () => {
    await render(
      <ResultModal
        visible={false}
        result={{ kind: 'submitted', at: '10.01 15:15' }}
        onConfirm={jest.fn()}
      />,
    );

    expect(screen.queryByText('제출 완료')).not.toBeOnTheScreen();
  });
});
