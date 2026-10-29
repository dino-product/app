import { NavigationContainer } from '@react-navigation/native';
import { render, screen } from '@testing-library/react-native';
import { AppStateProvider } from '../AppStateProvider';
import { RootNavigator } from './RootNavigator';

// 목록에 없는 요청(이미 처리됐거나 서버에서 취소됨)으로 화면이 열린 경우
const renderWithMissingRequest = (name: 'RequestDetail' | 'RejectReason') =>
  render(
    <AppStateProvider>
      <NavigationContainer
        initialState={{
          index: 1,
          routes: [{ name: 'Main' }, { name, params: { id: 'missing' } }],
        }}
      >
        <RootNavigator />
      </NavigationContainer>
    </AppStateProvider>,
  );

describe('RootNavigator — 없는 요청', () => {
  it.each(['RequestDetail', 'RejectReason'] as const)(
    '%s 는 빈 화면 대신 이전 화면으로 돌아간다',
    async name => {
      await renderWithMissingRequest(name);

      expect(
        await screen.findByRole('header', { name: '내 작업' }),
      ).toBeOnTheScreen();
      expect(
        screen.queryByRole('header', { name: '거절 사유' }),
      ).not.toBeOnTheScreen();
    },
  );
});
