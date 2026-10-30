import { NavigationContainer } from '@react-navigation/native';
import { render, screen } from '@testing-library/react-native';
import { AppStateProvider } from '../AppStateProvider';
import { RootNavigator } from './RootNavigator';

type Route = {
  name: 'Main' | 'RequestDetail' | 'RejectReason';
  params?: { id: string };
};

const renderAt = (routes: Route[]) =>
  render(
    <AppStateProvider>
      <NavigationContainer initialState={{ index: routes.length - 1, routes }}>
        <RootNavigator />
      </NavigationContainer>
    </AppStateProvider>,
  );

// 목록에 없는 요청(이미 처리됐거나 서버에서 취소됨)으로 화면이 열린 경우.
// 그 화면은 아무것도 그리지 않으므로, 탭 첫 화면(내 작업)이 보이는지로 이동을 확인한다.
describe('RootNavigator — 없는 요청', () => {
  it.each(['RequestDetail', 'RejectReason'] as const)(
    '%s 는 빈 화면 대신 이전 화면으로 돌아간다',
    async name => {
      await renderAt([{ name: 'Main' }, { name, params: { id: 'missing' } }]);

      expect(
        await screen.findByRole('header', { name: '내 작업' }),
      ).toBeOnTheScreen();
    },
  );

  it('돌아갈 화면이 없으면(딥링크로 바로 열림) 탭 첫 화면으로 바꾼다', async () => {
    await renderAt([{ name: 'RequestDetail', params: { id: 'missing' } }]);

    expect(
      await screen.findByRole('header', { name: '내 작업' }),
    ).toBeOnTheScreen();
  });
});
