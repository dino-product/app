import { focusManager, QueryClient } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import App from './App';

// 서버 상태 캐시(React Query)가 앱에 붙어 있는지 (#110). 화면은 아직 서버를 부르지 않는다
describe('App 서버 상태 캐시', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    focusManager.setFocused(undefined);
  });

  it('QueryClientProvider 가 QueryClient 를 앱에 붙인다', async () => {
    const mount = jest.spyOn(QueryClient.prototype, 'mount');

    await render(<App />);

    expect(mount).toHaveBeenCalledTimes(1);
  });

  it('앱이 background 로 갔다가 다시 active 가 되면 React Query 에 포커스를 알린다', async () => {
    const listeners: Array<(state: AppStateStatus) => void> = [];
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, handler) => {
        listeners.push(handler as (state: AppStateStatus) => void);
        return { remove: () => undefined };
      });
    const changeTo = (state: AppStateStatus) =>
      act(() => listeners.forEach(listener => listener(state)));
    await render(<App />);

    await changeTo('background');
    expect(focusManager.isFocused()).toBe(false);

    await changeTo('active');
    expect(focusManager.isFocused()).toBe(true);
  });
});
