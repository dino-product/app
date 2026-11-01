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

  it('기타 입력란에 쓰기 시작하면 기타가 선택된다', async () => {
    const onSubmit = jest.fn();
    await renderReject({ onSubmit });

    await userEvent.press(
      screen.getByRole('radio', { name: '일정이 맞지 않습니다' }),
    );
    await userEvent.type(
      screen.getByLabelText('기타 거절 사유 입력'),
      '개인 사정',
    );

    expect(
      screen.getByRole('radio', { name: '기타 (직접 입력)' }),
    ).toBeChecked();
    await userEvent.press(screen.getByRole('button', { name: '거절 제출' }));
    expect(onSubmit).toHaveBeenCalledWith('개인 사정');
  });

  describe('키보드', () => {
    // Platform.OS 만 바꾼다. 화면이 render 안에서 Platform.OS 를 읽어야 반영된다
    // (jest 의 Platform.select·모듈 상수는 늘 ios). prop 값 확인에만 쓴다
    const renderOn = async (os: 'ios' | 'android') => {
      jest.replaceProperty(Platform, 'OS', os);
      await renderReject();
      return screen.getByTestId('reject-reason-scroll');
    };

    afterEach(() => {
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

    // 스크롤 영역이 화면 위 80 ~ 700 이고 키보드 윗변이 500 이면 200 을 가린다
    const layoutBody = async () => {
      const body = screen.getByTestId('reject-reason-body');
      await fireEvent(body, 'layout', {
        nativeEvent: { layout: { x: 0, y: 80, width: 360, height: 620 } },
      });
      return body;
    };

    it('Android 는 키보드에 가린 만큼 스크롤 영역을 줄여 사유 입력칸이 키보드 위에 남는다', async () => {
      await renderOn('android');
      const body = await layoutBody();

      await showKeyboard(500);
      // 내용 여백이 아니라 스크롤 영역을 줄여야 Android ScrollView 가 포커스된 칸을 보이게 스크롤한다
      expect(body).toHaveStyle({ paddingBottom: 200 });
      expect(
        within(body).getByTestId('reject-reason-scroll'),
      ).toBeOnTheScreen();

      await hideKeyboard();
      expect(body).toHaveStyle({ paddingBottom: 0 });
    });

    it('iOS 는 키보드가 떠도 스크롤 영역을 줄이지 않는다', async () => {
      await renderOn('ios');
      const body = await layoutBody();

      await showKeyboard(500);

      expect(body).toHaveStyle({ paddingBottom: 0 });
      await hideKeyboard();
    });
  });
});
