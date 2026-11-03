import {
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import type { LoginMethod } from '../model';
import { LoginScreen } from './LoginScreen';

const renderLogin = async ({
  methods = ['KAKAO', 'APPLE'],
  recentMethod = null,
}: {
  methods?: LoginMethod[];
  recentMethod?: LoginMethod | null;
} = {}) => {
  const onLogin = jest.fn();
  await render(
    <LoginScreen
      methods={methods}
      recentMethod={recentMethod}
      onLogin={onLogin}
    />,
  );
  return onLogin;
};

const RECENT = '최근에 로그인 했어요!';
// 말풍선은 장식이라 스크린리더에서 빼고, 버튼 힌트로 읽는다
const bubbleIn = (method: LoginMethod) =>
  within(screen.getByTestId(`login-${method}`)).queryByText(RECENT, {
    includeHiddenElements: true,
  });

describe('LoginScreen', () => {
  it('Figma 문구와 두 시작 버튼을 보여준다', async () => {
    await renderLogin();

    expect(
      screen.getByRole('header', { name: '오늘의 현장, 한눈에. Orbit' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: '카카오로 시작하기' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Apple로 시작하기' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('신규 사용자도 카카오로 가입할 수 있습니다'),
    ).toBeOnTheScreen();
  });

  it('Android 처럼 카카오만 받으면 Apple 버튼은 없다', async () => {
    await renderLogin({ methods: ['KAKAO'] });

    expect(
      screen.getByRole('button', { name: '카카오로 시작하기' }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Apple로 시작하기' }),
    ).not.toBeOnTheScreen();
  });

  it.each(['KAKAO', 'APPLE'] as const)(
    '%s 버튼을 누르면 그 방식으로 로그인한다',
    async method => {
      const onLogin = await renderLogin();

      await userEvent.press(
        screen.getByRole('button', {
          name: method === 'KAKAO' ? '카카오로 시작하기' : 'Apple로 시작하기',
        }),
      );

      expect(onLogin).toHaveBeenCalledWith(method);
    },
  );

  describe('최근 로그인 말풍선', () => {
    it('처음에는 어느 버튼에도 없다', async () => {
      await renderLogin();

      expect(bubbleIn('KAKAO')).not.toBeOnTheScreen();
      expect(bubbleIn('APPLE')).not.toBeOnTheScreen();
    });

    it('마지막에 쓴 방식의 버튼 위에만 보이고, 스크린리더는 버튼 힌트로 읽는다', async () => {
      await renderLogin({ recentMethod: 'APPLE' });

      expect(bubbleIn('APPLE')).toBeOnTheScreen();
      expect(bubbleIn('KAKAO')).not.toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: 'Apple로 시작하기' }).props
          .accessibilityHint,
      ).toBe(RECENT);
      expect(
        screen.getByRole('button', { name: '카카오로 시작하기' }).props
          .accessibilityHint,
      ).toBeUndefined();
    });

    it('마지막 방식의 버튼이 없는 플랫폼이면(Apple 로 로그인했던 Android) 말풍선도 없다', async () => {
      await renderLogin({ methods: ['KAKAO'], recentMethod: 'APPLE' });

      expect(bubbleIn('KAKAO')).not.toBeOnTheScreen();
    });
  });
});
