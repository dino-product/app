import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { workDetail } from '../mockData';
import { WorkDetailScreen } from './WorkDetailScreen';

const renderDetail = (
  overrides: Partial<Parameters<typeof WorkDetailScreen>[0]> = {},
) =>
  render(
    <WorkDetailScreen
      work={workDetail}
      onBack={jest.fn()}
      onSubmitReport={jest.fn(() => ({ kind: 'submitted', at: '10.01 15:15' }))}
      onDone={jest.fn()}
      onCall={jest.fn()}
      onNavigate={jest.fn()}
      onPickPhoto={jest.fn(async () => 'mock://photo')}
      {...overrides}
    />,
  );

async function fillRequired() {
  await userEvent.press(
    screen.getByRole('button', { name: '작업 전 사진 추가' }),
  );
  await userEvent.press(
    screen.getByRole('button', { name: '작업 후 사진 추가' }),
  );
  await userEvent.type(screen.getByLabelText('결제 금액 입력'), '75000');
  await userEvent.press(screen.getByRole('button', { name: '결제 방식 선택' }));
  await userEvent.press(screen.getByRole('button', { name: '카드' }));
}

describe('WorkDetailScreen', () => {
  it('작업명·상태·작업번호와 일정·고객 정보를 보여준다', async () => {
    await renderDetail();

    expect(screen.getByRole('header', { name: '작업 상세' })).toBeOnTheScreen();
    expect(screen.getByText('도어록 교체')).toBeOnTheScreen();
    expect(screen.getByText('배정됨')).toBeOnTheScreen();
    expect(screen.getByText('20260410-DMASX')).toBeOnTheScreen();
    expect(screen.getByText('2025-07-19 (토)')).toBeOnTheScreen();
    expect(screen.getByText('김현수')).toBeOnTheScreen();
    expect(screen.getByText('박민지')).toBeOnTheScreen();
    expect(screen.getByText('75,000원')).toBeOnTheScreen();
  });

  it('뒤로·전화·길찾기 버튼이 각 콜백을 호출한다', async () => {
    const onBack = jest.fn();
    const onCall = jest.fn();
    const onNavigate = jest.fn();
    await renderDetail({ onBack, onCall, onNavigate });

    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
    await userEvent.press(
      screen.getByRole('button', { name: '박민지 고객에게 전화' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '길찾기' }));

    expect(onBack).toHaveBeenCalled();
    expect(onCall).toHaveBeenCalledWith('010-1234-5678');
    expect(onNavigate).toHaveBeenCalledWith(workDetail.address);
  });

  it('필수 항목을 채우기 전에는 완료보고 제출이 비활성이다', async () => {
    await renderDetail();

    expect(
      screen.getByRole('button', { name: '완료보고 제출' }),
    ).toBeDisabled();
  });

  it('필수 항목을 채우면 제출할 수 있고, 제출 결과 모달을 띄운다', async () => {
    const onSubmitReport = jest.fn(() => ({
      kind: 'submitted' as const,
      at: '10.01 15:15',
    }));
    const onDone = jest.fn();
    await renderDetail({ onSubmitReport, onDone });

    await fillRequired();
    const submit = screen.getByRole('button', { name: '완료보고 제출' });
    expect(submit).toBeEnabled();
    await userEvent.press(submit);

    expect(onSubmitReport).toHaveBeenCalledWith(
      expect.objectContaining({
        beforePhotos: ['mock://photo'],
        afterPhotos: ['mock://photo'],
        amount: '75000',
        paymentMethod: 'card',
      }),
    );
    expect(
      await screen.findByRole('header', { name: '제출 완료' }),
    ).toBeOnTheScreen();

    await userEvent.press(
      screen.getByRole('button', { name: '메인 화면으로' }),
    );
    expect(onDone).toHaveBeenCalled();
  });

  it('결제 금액에는 숫자만 남긴다', async () => {
    await renderDetail();

    await userEvent.type(screen.getByLabelText('결제 금액 입력'), '7a5,0원00');

    expect(screen.getByLabelText('결제 금액 입력')).toHaveDisplayValue('75000');
  });

  it('결제 금액의 앞자리 0 은 지운다', async () => {
    await renderDetail();

    await userEvent.type(screen.getByLabelText('결제 금액 입력'), '0075');

    expect(screen.getByLabelText('결제 금액 입력')).toHaveDisplayValue('75');
  });

  it('사진을 지우면 다시 제출할 수 없다', async () => {
    await renderDetail();
    await fillRequired();

    await userEvent.press(
      screen.getByRole('button', { name: '작업 전 사진 1 삭제' }),
    );

    expect(screen.getByText('0/5')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: '완료보고 제출' }),
    ).toBeDisabled();
  });

  describe('완료 보고 작성하기 버튼', () => {
    async function layout() {
      await fireEvent(screen.getByTestId('work-detail-scroll'), 'layout', {
        nativeEvent: { layout: { height: 700 } },
      });
      await fireEvent(screen.getByTestId('work-report-section'), 'layout', {
        nativeEvent: { layout: { y: 1500 } },
      });
    }

    const scrollTo = (y: number) =>
      fireEvent.scroll(screen.getByTestId('work-detail-scroll'), {
        nativeEvent: { contentOffset: { y } },
      });

    it('완료 보고 영역이 화면에 올라오면 숨고, 다시 위로 가면 나타난다', async () => {
      await renderDetail();
      await layout();

      await scrollTo(1000); // 화면 아래 끝 1700 ≥ 1500 + 120
      expect(
        screen.queryByRole('button', { name: '완료 보고 작성하기' }),
      ).not.toBeOnTheScreen();

      await scrollTo(0);
      expect(
        screen.getByRole('button', { name: '완료 보고 작성하기' }),
      ).toBeOnTheScreen();
    });
  });

  it('작업이 취소된 결과면 취소 모달을 보여준다', async () => {
    await renderDetail({
      onSubmitReport: jest.fn(() => ({
        kind: 'canceled' as const,
        reason: '고객 요청',
        at: '10.01 15:15',
      })),
    });
    await fillRequired();

    await userEvent.press(
      screen.getByRole('button', { name: '완료보고 제출' }),
    );

    expect(
      await screen.findByRole('header', { name: '작업이 취소되었습니다' }),
    ).toBeOnTheScreen();
  });

  it('제출 중에는 버튼을 막아 중복 제출하지 않는다', async () => {
    let resolve: (value: { kind: 'submitted'; at: string }) => void = () => {};
    const onSubmitReport = jest.fn(
      () => new Promise<{ kind: 'submitted'; at: string }>(r => (resolve = r)),
    );
    await renderDetail({ onSubmitReport });
    await fillRequired();

    const submit = screen.getByRole('button', { name: '완료보고 제출' });
    await userEvent.press(submit);
    await userEvent.press(submit);

    expect(onSubmitReport).toHaveBeenCalledTimes(1);
    expect(submit).toBeDisabled();
    resolve({ kind: 'submitted', at: '10.01 15:15' });
    expect(
      await screen.findByRole('header', { name: '제출 완료' }),
    ).toBeOnTheScreen();
  });

  it('제출이 실패하면 다시 누를 수 있다', async () => {
    const onSubmitReport = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockReturnValue({ kind: 'submitted', at: '10.01 15:15' });
    await renderDetail({ onSubmitReport });
    await fillRequired();

    await userEvent.press(
      screen.getByRole('button', { name: '완료보고 제출' }),
    );

    expect(screen.getByRole('button', { name: '완료보고 제출' })).toBeEnabled();
    expect(screen.queryByRole('header', { name: '제출 완료' })).toBeNull();
  });

  it('사진을 고르지 않거나 실패하면 아무것도 추가하지 않는다', async () => {
    const onPickPhoto = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('denied'));
    await renderDetail({ onPickPhoto });

    await userEvent.press(
      screen.getByRole('button', { name: '작업 전 사진 추가' }),
    );
    await userEvent.press(
      screen.getByRole('button', { name: '작업 전 사진 추가' }),
    );

    expect(screen.getAllByText('0/5')).toHaveLength(2);
  });

  it('결제 방식 선택 버튼이 고른 값을 스크린리더에 알린다', async () => {
    await renderDetail();

    await userEvent.press(
      screen.getByRole('button', { name: '결제 방식 선택' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '카드' }));

    expect(
      screen.getByRole('button', { name: '결제 방식 선택' }),
    ).toHaveAccessibilityValue({ text: '카드' });
  });
});
