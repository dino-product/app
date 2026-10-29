import { render, screen, userEvent } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import App from './App';

describe('App', () => {
  it('첫 화면은 작업 수행 메인화면(내 작업)이다', async () => {
    await render(<App />);

    expect(screen.getByRole('header', { name: '내 작업' })).toBeOnTheScreen();
  });

  it('작업을 열면 작업 상세로, 뒤로 가기로 메인화면으로 돌아온다', async () => {
    await render(<App />);

    await userEvent.press(
      screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
    );
    expect(screen.getByRole('header', { name: '작업 상세' })).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(screen.getByRole('header', { name: '내 작업' })).toBeOnTheScreen();
  });

  it('작업을 시작하고 상세에 다녀와도 "작업 수행중" 이 유지된다', async () => {
    await render(<App />);

    await userEvent.press(screen.getByRole('button', { name: '작업 시작' }));
    await userEvent.press(screen.getByRole('button', { name: '작업 수행중' }));
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(
      screen.getByRole('button', { name: '작업 수행중' }),
    ).toBeOnTheScreen();
  });

  it('Android 뒤로가기를 누르면 상세에서 메인화면으로 돌아온다', async () => {
    const listeners: Array<Parameters<typeof BackHandler.addEventListener>[1]> =
      [];
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        listeners.push(handler);
        return { remove: jest.fn() };
      });
    await render(<App />);

    await userEvent.press(
      screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
    );
    const handled = listeners[listeners.length - 1](
      // RN 0.88 의 핸들러는 이벤트 인자를 받지만 App 은 쓰지 않는다
      undefined as never,
    );

    expect(handled).toBe(true);
    expect(
      await screen.findByRole('header', { name: '내 작업' }),
    ).toBeOnTheScreen();
    jest.restoreAllMocks();
  });
});
