import {
  act,
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { NativeModules } from 'react-native';
import { noTermsAgreed } from '../model';
import { TermsAgreementScreen } from './TermsAgreementScreen';

// 바텀시트 애니메이션(프리셋의 네이티브 애니메이션 목)은 테스트가 끝낸다
let runningAnimations: Array<(result: { finished: boolean }) => void> = [];
const finishAnimations = () =>
  act(() => {
    runningAnimations.splice(0).forEach(end => end({ finished: true }));
  });
beforeEach(() => {
  runningAnimations = [];
  jest
    .spyOn(NativeModules.NativeAnimatedModule, 'startAnimatingNode')
    .mockImplementation((...args: unknown[]) => {
      runningAnimations.push(
        args[3] as (result: { finished: boolean }) => void,
      );
    });
});
afterEach(() => {
  jest.restoreAllMocks();
});

const renderTerms = async () => {
  const props = { onBack: jest.fn(), onSignUp: jest.fn() };
  await render(<TermsAgreementScreen {...props} />);
  return props;
};

const rows = [
  '서비스 이용약관 (필수)',
  '개인정보 처리방침 (필수)',
  '제3자 제공 동의 (필수)',
  '위치기반 서비스 이용약관 (필수)',
  '혜택 이벤트 알림 수신동의 (선택)',
] as const;

const checkbox = (name: string) => screen.getByRole('checkbox', { name });
const allAgree = () => checkbox('모든 약관에 동의합니다.');
const signUp = () => screen.getByRole('button', { name: '가입하기' });
const sheet = () => screen.getByTestId('terms-sheet');

async function openSheet(row: string = rows[0]) {
  await userEvent.press(screen.getByRole('button', { name: `${row} 보기` }));
  await finishAnimations();
}

describe('TermsAgreementScreen', () => {
  it('제목과 약관 행 다섯 개(필수 4, 선택 1)를 모두 꺼진 채 보여준다', async () => {
    await renderTerms();

    expect(
      screen.getByRole('header', {
        name: '서비스 이용을 위해 동의가 필요해요',
      }),
    ).toBeOnTheScreen();
    expect(allAgree()).not.toBeChecked();
    for (const row of rows) {
      expect(checkbox(row)).not.toBeChecked();
    }
    expect(signUp()).toBeDisabled();
  });

  it('모든 약관에 동의합니다를 누르면 다섯 개가 모두 켜지고, 다시 누르면 모두 꺼진다', async () => {
    await renderTerms();

    await userEvent.press(allAgree());
    expect(allAgree()).toBeChecked();
    for (const row of rows) {
      expect(checkbox(row)).toBeChecked();
    }
    expect(signUp()).toBeEnabled();

    await userEvent.press(allAgree());
    for (const row of rows) {
      expect(checkbox(row)).not.toBeChecked();
    }
    expect(signUp()).toBeDisabled();
  });

  it('필수 네 개를 모두 켜야 가입하기가 켜진다. 선택은 꺼져 있어도 된다', async () => {
    const { onSignUp } = await renderTerms();

    for (const row of rows.slice(0, 3)) {
      await userEvent.press(checkbox(row));
    }
    expect(signUp()).toBeDisabled();

    await userEvent.press(checkbox(rows[3]));
    expect(signUp()).toBeEnabled();
    // 하나라도 꺼져 있으면 전체 동의는 꺼진 채다
    expect(allAgree()).not.toBeChecked();

    await userEvent.press(signUp());
    expect(onSignUp).toHaveBeenCalledWith({
      ...noTermsAgreed,
      SERVICE: true,
      PRIVACY: true,
      THIRD_PARTY: true,
      LOCATION: true,
    });
  });

  it('행을 하나씩 모두 켜면 전체 동의도 켜진다', async () => {
    await renderTerms();

    for (const row of rows) {
      await userEvent.press(checkbox(row));
    }

    expect(allAgree()).toBeChecked();
  });

  describe('약관 시트', () => {
    it('행의 > 를 누르면 약관 동의 시트가 열리고 약관마다 제목과 본문이 있다', async () => {
      await renderTerms();

      await openSheet();

      const inSheet = within(sheet());
      expect(
        inSheet.getByRole('header', { name: '약관 동의' }),
      ).toBeOnTheScreen();
      expect(
        inSheet.getByRole('checkbox', { name: '서비스 이용약관 동의 (필수)' }),
      ).toBeOnTheScreen();
      expect(
        inSheet.getByRole('checkbox', {
          name: '혜택 이벤트 알림 수신동의 (선택)',
        }),
      ).toBeOnTheScreen();
      expect(inSheet.getAllByText(/^제1조 \(목적\)/)).toHaveLength(5);
    });

    it('전체 동의를 체크해야 확인이 켜지고, 확인하면 화면 체크에 반영된다', async () => {
      await renderTerms();
      await openSheet();
      const inSheet = within(sheet());
      const confirm = () => inSheet.getByRole('button', { name: '확인' });

      expect(confirm()).toBeDisabled();
      await userEvent.press(
        inSheet.getByRole('checkbox', { name: '전체 동의' }),
      );
      expect(
        inSheet.getByRole('checkbox', {
          name: '개인정보 처리방침 동의 (필수)',
        }),
      ).toBeChecked();
      expect(confirm()).toBeEnabled();

      await userEvent.press(confirm());
      await finishAnimations();

      expect(screen.queryByTestId('terms-sheet')).not.toBeOnTheScreen();
      expect(allAgree()).toBeChecked();
      expect(signUp()).toBeEnabled();
    });

    it('시트에서 하나라도 끄면 확인이 다시 꺼진다', async () => {
      await renderTerms();
      await openSheet();
      const inSheet = within(sheet());

      await userEvent.press(
        inSheet.getByRole('checkbox', { name: '전체 동의' }),
      );
      await userEvent.press(
        inSheet.getByRole('checkbox', {
          name: '혜택 이벤트 알림 수신동의 (선택)',
        }),
      );

      expect(
        inSheet.getByRole('checkbox', { name: '전체 동의' }),
      ).not.toBeChecked();
      expect(inSheet.getByRole('button', { name: '확인' })).toBeDisabled();
    });

    it('닫기를 누르면 시트에서 바꾼 체크는 화면에 반영하지 않는다', async () => {
      await renderTerms();
      await openSheet();
      const inSheet = within(sheet());

      await userEvent.press(
        inSheet.getByRole('checkbox', { name: '전체 동의' }),
      );
      await userEvent.press(inSheet.getByRole('button', { name: '닫기' }));
      await finishAnimations();

      expect(screen.queryByTestId('terms-sheet')).not.toBeOnTheScreen();
      expect(allAgree()).not.toBeChecked();
      expect(checkbox(rows[0])).not.toBeChecked();
    });

    it('시트는 화면에서 켠 체크를 이어받아 열린다', async () => {
      await renderTerms();
      await userEvent.press(checkbox(rows[1]));

      await openSheet(rows[2]);

      expect(
        within(sheet()).getByRole('checkbox', {
          name: '개인정보 처리방침 동의 (필수)',
        }),
      ).toBeChecked();
      expect(
        within(sheet()).getByRole('checkbox', {
          name: '서비스 이용약관 동의 (필수)',
        }),
      ).not.toBeChecked();
    });
  });

  it('뒤로 가기를 누르면 알린다', async () => {
    const { onBack } = await renderTerms();

    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(onBack).toHaveBeenCalled();
  });
});
