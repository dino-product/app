import {
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { Platform } from 'react-native';
import { hideKeyboard, showKeyboard } from '../../../../jest/keyboard';
import { colors } from '../../../shared/design-system';
import { haptic } from '../../../shared/haptics';
import { workDetail } from '../mockData';
import type { WorkDetail } from '../model';
import { WorkDetailScreen } from './WorkDetailScreen';

jest.mock('../../../shared/haptics', () => ({
  haptic: { success: jest.fn(), warning: jest.fn(), selection: jest.fn() },
}));

beforeEach(() => {
  jest.mocked(haptic.success).mockClear();
  jest.mocked(haptic.selection).mockClear();
});

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
  await userEvent.press(screen.getByRole('button', { name: '현장 카드' }));
}

// 같은 부모 아래에서 a 가 b 보다 앞에 있는지 (스크린리더가 읽는 순서)
function comesBefore(
  a: ReturnType<typeof screen.getByText>,
  b: ReturnType<typeof screen.getByText>,
) {
  const siblings = a.parent?.children ?? [];
  expect(b.parent).toBe(a.parent);
  expect(siblings.indexOf(a)).toBeLessThan(siblings.indexOf(b));
}

const submittedWork: WorkDetail = {
  ...workDetail,
  submission: {
    submittedAt: '2026-12-19 11:32',
    report: {
      beforePhotos: ['mock://before-1', 'mock://before-2'],
      afterPhotos: ['mock://after-1'],
      memo: '배터리 교체',
      parts: '건전지 4개',
      amount: '120000',
      paymentMethod: 'card',
    },
  },
};

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

    expect(screen.getByLabelText('결제 금액 입력')).toHaveDisplayValue(
      '75,000',
    );
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

    expect(screen.getByText('0/6')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: '완료보고 제출' }),
    ).toBeDisabled();
  });

  it('사진은 단계별 6장까지 추가하고 7장째는 추가되지 않는다', async () => {
    let n = 0;
    await renderDetail({ onPickPhoto: jest.fn(async () => `mock://${++n}`) });

    const add = screen.getByRole('button', { name: '작업 전 사진 추가' });
    for (let i = 0; i < 7; i += 1) {
      await userEvent.press(add);
    }

    expect(screen.getByText('6/6')).toBeOnTheScreen();
    expect(add).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: '작업 전 사진 7 삭제' }),
    ).not.toBeOnTheScreen();
  });

  it('수행 메모·사용 부품 제목 뒤에 회색 "(선택)" 을 붙이고 "…, 선택" 으로 읽는다', async () => {
    await renderDetail();

    expect(
      screen.getByRole('header', { name: '수행 메모, 선택' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: '사용 부품, 선택' }),
    ).toBeOnTheScreen();
    const optional = screen.getAllByText('(선택)');
    expect(optional).toHaveLength(2);
    for (const text of optional) {
      expect(text).toHaveStyle({ color: colors.gray[500] });
    }
  });

  it('사용 부품은 한 줄 입력이고 수행 메모만 여러 줄이다', async () => {
    await renderDetail();

    expect(screen.getByLabelText('사용 부품 입력')).not.toHaveProp(
      'multiline',
      true,
    );
    expect(screen.getByLabelText('수행 메모 입력')).toHaveProp(
      'multiline',
      true,
    );
  });

  it('완료보고 제출 위에 "제출 후 수정 불가" 를 두고 버튼보다 먼저 읽게 한다', async () => {
    await renderDetail();

    const notice = screen.getByText('제출 후 수정 불가');
    comesBefore(notice, screen.getByRole('button', { name: '완료보고 제출' }));
  });

  describe('제출을 마친 작업', () => {
    it('입력값을 읽기 전용으로 보여주고, 제출 시각과 비활성 "제출 완료" 버튼을 보여준다', async () => {
      await renderDetail({ work: submittedWork });

      const done = screen.getByRole('button', { name: '제출 완료' });
      expect(done).toBeDisabled();
      comesBefore(screen.getByText('제출 시각 2026-12-19 11:32'), done);
      expect(screen.queryByText('제출 후 수정 불가')).not.toBeOnTheScreen();
      expect(
        screen.queryByRole('button', { name: '완료보고 제출' }),
      ).not.toBeOnTheScreen();

      const amount = screen.getByLabelText('결제 금액 입력');
      expect(amount).toHaveDisplayValue('120,000');
      expect(amount).toHaveProp('editable', false);
      expect(screen.getByLabelText('수행 메모 입력')).toHaveDisplayValue(
        '배터리 교체',
      );
      expect(screen.getByLabelText('수행 메모 입력')).toHaveProp(
        'editable',
        false,
      );
      expect(screen.getByLabelText('사용 부품 입력')).toHaveDisplayValue(
        '건전지 4개',
      );
      expect(screen.getByLabelText('사용 부품 입력')).toHaveProp(
        'editable',
        false,
      );
      // 결제 방식은 펼침 화살표 없이 고른 값만 보인다
      expect(screen.getByText('현장 카드')).toBeOnTheScreen();
      expect(
        screen.queryByRole('button', { name: '결제 방식 선택' }),
      ).not.toBeOnTheScreen();
    });

    it('제출한 사진을 보여주고 더 넣거나 지울 수 없다', async () => {
      const onPickPhoto = jest.fn(async () => 'mock://photo');
      await renderDetail({ work: submittedWork, onPickPhoto });

      expect(screen.getByText('2/6')).toBeOnTheScreen();
      expect(screen.getByText('1/6')).toBeOnTheScreen();
      const add = screen.getByRole('button', { name: '작업 전 사진 추가' });
      const remove = screen.getByRole('button', {
        name: '작업 전 사진 1 삭제',
      });
      await userEvent.press(add);
      await userEvent.press(remove);

      expect(add).toBeDisabled();
      expect(remove).toBeDisabled();
      expect(onPickPhoto).not.toHaveBeenCalled();
      expect(screen.getByText('2/6')).toBeOnTheScreen();
    });

    it('작성 중이라고 알리지 않는다 (나갈 때 묻지 않는다)', async () => {
      const onUnsavedReportChange = jest.fn();
      await renderDetail({ work: submittedWork, onUnsavedReportChange });

      expect(onUnsavedReportChange).not.toHaveBeenCalledWith(true);
    });

    it('작성하던 보고가 제출되면 작성 중이 아니라고 알린다', async () => {
      const onUnsavedReportChange = jest.fn();
      const props = {
        onBack: jest.fn(),
        onSubmitReport: jest.fn(() => ({
          kind: 'submitted' as const,
          at: '10.01 15:15',
        })),
        onDone: jest.fn(),
        onCall: jest.fn(),
        onNavigate: jest.fn(),
        onPickPhoto: jest.fn(async () => null),
        onUnsavedReportChange,
      };
      await render(<WorkDetailScreen work={workDetail} {...props} />);
      await userEvent.type(screen.getByLabelText('수행 메모 입력'), '배관');
      expect(onUnsavedReportChange).toHaveBeenLastCalledWith(true);

      // 입력은 화면에 남아 있지만 제출 정보가 들어오면 잃을 입력이 아니다
      await screen.rerender(
        <WorkDetailScreen work={submittedWork} {...props} />,
      );

      expect(onUnsavedReportChange).toHaveBeenLastCalledWith(false);
    });

    it('"완료 보고 작성하기" 버튼을 띄우지 않는다', async () => {
      await renderDetail({ work: submittedWork });

      expect(
        screen.queryByRole('button', { name: '완료 보고 작성하기' }),
      ).not.toBeOnTheScreen();
    });
  });

  describe('키보드', () => {
    // Platform.OS 만 바꾼다. render·effect 안에서 읽는 Platform.OS 에만 반영된다
    // (jest 의 Platform.select·모듈 상수는 늘 ios)
    const renderOn = async (os: 'ios' | 'android') => {
      jest.replaceProperty(Platform, 'OS', os);
      await renderDetail();
      return screen.getByTestId('work-detail-scroll');
    };

    afterEach(async () => {
      // Keyboard 모듈은 마지막 키보드 상태를 들고 있어 다음 테스트로 넘어가지 않게 내린다
      await hideKeyboard();
      jest.restoreAllMocks();
    });

    it('iOS 는 내용을 끌어내리면 키보드가 따라 내려간다', async () => {
      const scroll = await renderOn('ios');

      expect(scroll).toHaveProp('keyboardDismissMode', 'interactive');
      expect(scroll).toHaveProp('keyboardShouldPersistTaps', 'handled');
      expect(scroll).toHaveProp('automaticallyAdjustKeyboardInsets', true);
    });

    it('Android 는 interactive 가 없어 끌기 시작하면 내린다', async () => {
      const scroll = await renderOn('android');

      expect(scroll).toHaveProp('keyboardDismissMode', 'on-drag');
      expect(scroll).toHaveProp('keyboardShouldPersistTaps', 'handled');
    });

    // 스크롤 영역이 화면 위 100 ~ 800 이고 키보드 윗변이 500 이면 300 을 가린다
    const layoutBody = async () => {
      const body = screen.getByTestId('work-detail-body');
      await fireEvent(body, 'layout', {
        nativeEvent: { layout: { x: 0, y: 100, width: 360, height: 700 } },
      });
      return body;
    };

    it('Android 는 키보드에 가린 만큼 스크롤 영역을 줄여 입력칸이 키보드 위에 남는다', async () => {
      await renderOn('android');
      const body = await layoutBody();

      await showKeyboard(500);
      // 내용 여백이 아니라 스크롤 영역을 줄여야 Android ScrollView 가 포커스된 칸을 보이게 스크롤한다
      expect(body).toHaveStyle({ paddingBottom: 300 });
      expect(within(body).getByTestId('work-detail-scroll')).toBeOnTheScreen();

      await hideKeyboard();
      expect(body).toHaveStyle({ paddingBottom: 0 });
    });

    it('iOS 는 키보드가 떠도 스크롤 영역을 줄이지 않는다', async () => {
      await renderOn('ios');
      const body = await layoutBody();

      await showKeyboard(500);

      expect(body).toHaveStyle({ paddingBottom: 0 });
    });
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

    // #95: Figma 작업수행-상세 (2741:2713) 의 Frame 2147238742 (2741:3417)
    describe('버튼 뒤 그라데이션', () => {
      const fade = () =>
        screen.queryByTestId('work-detail-jump-fade', {
          includeHiddenElements: true,
        });

      // Figma 레이어는 393×320, 프레임 위 532 에서 아래 끝(852)까지다. 앱 화면은 탭 바(102) 위에서 끝나 그 위 218 이 보인다.
      // 채움은 #F0F0F0 투명(0%) → 불투명(54.3%), 위→아래이고 변환 행렬로 레이어 높이의 6.1%~57.1% 구간에 걸친다.
      // 320 기준 19.5 ~ 182.8 이라 보이는 218 안에서는 8.96% ~ 83.84% 다
      it('버튼이 보이면 그 뒤 탭 바 위 218 에 #F0F0F0 그라데이션이 깔린다', async () => {
        await renderDetail();

        expect(fade()).toHaveStyle({
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 218,
          backgroundImage:
            'linear-gradient(to bottom, rgba(240, 240, 240, 0) 8.96%, rgba(240, 240, 240, 1) 83.84%)',
        });
      });

      it('버튼보다 뒤에 그린다', async () => {
        await renderDetail();

        const button = screen.getByRole('button', {
          name: '완료 보고 작성하기',
        });
        let wrapper = button.parent;
        while (wrapper && wrapper.parent !== fade()?.parent) {
          wrapper = wrapper.parent;
        }
        const siblings = fade()?.parent?.children ?? [];
        expect(siblings.indexOf(fade()!)).toBeLessThan(
          siblings.indexOf(wrapper!),
        );
      });

      it('터치를 막지 않고(아래 스크롤·입력칸으로 간다) 스크린리더에서 숨는다', async () => {
        await renderDetail();

        expect(fade()).toHaveStyle({ pointerEvents: 'none' });
        expect(
          screen.queryByTestId('work-detail-jump-fade'),
        ).not.toBeOnTheScreen();
      });

      it('보고 영역까지 스크롤해 버튼이 숨으면 그라데이션도 없다', async () => {
        await renderDetail();
        await layout();

        await scrollTo(1000);
        expect(fade()).not.toBeOnTheScreen();

        await scrollTo(0);
        expect(fade()).toBeOnTheScreen();
      });

      it('제출을 마친 읽기 전용 상세에는 없다', async () => {
        await renderDetail({ work: submittedWork });

        expect(fade()).not.toBeOnTheScreen();
      });
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

  it('제출이 성공하면 성공 햅틱을 한 번 울린다', async () => {
    await renderDetail();
    await fillRequired();
    expect(haptic.success).not.toHaveBeenCalled();

    await userEvent.press(
      screen.getByRole('button', { name: '완료보고 제출' }),
    );
    expect(haptic.success).toHaveBeenCalledTimes(1);
  });

  it('제출이 실패하면 햅틱을 울리지 않는다', async () => {
    const onSubmitReport = jest.fn().mockRejectedValue(new Error('network'));
    await renderDetail({ onSubmitReport });
    await fillRequired();

    await userEvent.press(
      screen.getByRole('button', { name: '완료보고 제출' }),
    );
    expect(haptic.success).not.toHaveBeenCalled();
  });

  it('작업이 취소돼 제출이 반려되면 성공 햅틱을 울리지 않는다', async () => {
    const onSubmitReport = jest.fn(() => ({
      kind: 'canceled' as const,
      reason: '고객 취소',
      at: '10.01 15:15',
    }));
    await renderDetail({ onSubmitReport });
    await fillRequired();

    await userEvent.press(
      screen.getByRole('button', { name: '완료보고 제출' }),
    );
    expect(haptic.success).not.toHaveBeenCalled();
  });

  it('결제 방식을 고르면 선택 햅틱을 울린다', async () => {
    await renderDetail();
    await userEvent.press(
      screen.getByRole('button', { name: '결제 방식 선택' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '현장 카드' }));
    expect(haptic.selection).toHaveBeenCalledTimes(1);
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

    expect(screen.getAllByText('0/6')).toHaveLength(2);
  });

  describe('작성 중인 완료 보고 알림', () => {
    it('입력하면 작성 중으로, 다 지우면 작성 중이 아니라고 알린다', async () => {
      const onUnsavedReportChange = jest.fn();
      await renderDetail({ onUnsavedReportChange });
      expect(onUnsavedReportChange).not.toHaveBeenCalledWith(true);

      await userEvent.type(screen.getByLabelText('수행 메모 입력'), '배관');
      expect(onUnsavedReportChange).toHaveBeenLastCalledWith(true);

      await userEvent.clear(screen.getByLabelText('수행 메모 입력'));
      expect(onUnsavedReportChange).toHaveBeenLastCalledWith(false);
    });

    it('입력이 바뀌어도 작성 중 여부가 같으면 다시 알리지 않는다', async () => {
      const onUnsavedReportChange = jest.fn();
      await renderDetail({ onUnsavedReportChange });

      await userEvent.type(screen.getByLabelText('수행 메모 입력'), '배관');
      await userEvent.type(screen.getByLabelText('사용 부품 입력'), '밸브');

      expect(
        onUnsavedReportChange.mock.calls.filter(([unsaved]) => unsaved),
      ).toHaveLength(1);
    });

    it('제출을 마치면 작성 중이 아니라고 알린다', async () => {
      const onUnsavedReportChange = jest.fn();
      await renderDetail({ onUnsavedReportChange });
      await fillRequired();
      expect(onUnsavedReportChange).toHaveBeenLastCalledWith(true);

      await userEvent.press(
        screen.getByRole('button', { name: '완료보고 제출' }),
      );

      expect(
        await screen.findByRole('header', { name: '제출 완료' }),
      ).toBeOnTheScreen();
      expect(onUnsavedReportChange).toHaveBeenLastCalledWith(false);
    });

    it('제출이 실패하면 계속 작성 중이다', async () => {
      const onUnsavedReportChange = jest.fn();
      await renderDetail({
        onUnsavedReportChange,
        onSubmitReport: jest.fn().mockRejectedValue(new Error('network')),
      });
      await fillRequired();

      await userEvent.press(
        screen.getByRole('button', { name: '완료보고 제출' }),
      );

      expect(onUnsavedReportChange).toHaveBeenLastCalledWith(true);
      expect(onUnsavedReportChange).not.toHaveBeenLastCalledWith(false);
    });
  });

  // 앱이 종료됐다가 다시 열리면 기기에 남긴 초안으로 이어 쓴다 (#34)
  describe('작성하던 보고 이어 쓰기', () => {
    const draft = {
      beforePhotos: ['mock://before-1'],
      afterPhotos: ['mock://after-1', 'mock://after-2'],
      memo: '배관 누수',
      parts: '밸브',
      amount: '75000',
      paymentMethod: 'cash' as const,
    };

    it('처음 입력값을 받으면 그 값으로 열리고 이어서 제출할 수 있다', async () => {
      await renderDetail({ initialReport: draft });

      expect(screen.getByLabelText('수행 메모 입력')).toHaveDisplayValue(
        '배관 누수',
      );
      expect(screen.getByLabelText('사용 부품 입력')).toHaveDisplayValue(
        '밸브',
      );
      expect(screen.getByLabelText('결제 금액 입력')).toHaveDisplayValue(
        '75,000',
      );
      expect(
        screen.getByRole('button', { name: '결제 방식 선택' }),
      ).toHaveAccessibilityValue({ text: '현장 현금' });
      expect(
        screen.getByRole('button', { name: '작업 후 사진 추가' }),
      ).toHaveAccessibilityValue({ text: '2/6' });
      expect(
        screen.getByRole('button', { name: '완료보고 제출' }),
      ).toBeEnabled();
    });

    it('이어 쓰는 보고는 처음부터 작성 중이라고 알린다', async () => {
      const onUnsavedReportChange = jest.fn();
      await renderDetail({ initialReport: draft, onUnsavedReportChange });

      expect(onUnsavedReportChange).toHaveBeenLastCalledWith(true);
    });

    it('입력·사진이 바뀔 때마다 지금 보고를 넘긴다', async () => {
      const onReportChange = jest.fn();
      await renderDetail({ onReportChange });

      await userEvent.type(screen.getByLabelText('수행 메모 입력'), '배관');
      expect(onReportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ memo: '배관' }),
      );

      await userEvent.press(
        screen.getByRole('button', { name: '작업 전 사진 추가' }),
      );
      expect(onReportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ beforePhotos: ['mock://photo'] }),
      );

      await userEvent.press(
        screen.getByRole('button', { name: '작업 전 사진 1 삭제' }),
      );
      expect(onReportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ beforePhotos: [], memo: '배관' }),
      );
    });

    it('제출을 마친 작업은 넘길 보고가 없다', async () => {
      const onReportChange = jest.fn();
      await renderDetail({ work: submittedWork, onReportChange });

      expect(onReportChange).not.toHaveBeenCalled();
    });
  });

  it('결제 방식 선택 버튼이 고른 값을 스크린리더에 알린다', async () => {
    await renderDetail();

    await userEvent.press(
      screen.getByRole('button', { name: '결제 방식 선택' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '현장 카드' }));

    expect(
      screen.getByRole('button', { name: '결제 방식 선택' }),
    ).toHaveAccessibilityValue({ text: '현장 카드' });
  });
});
