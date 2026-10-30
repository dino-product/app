import {
  CommonActions,
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { AppStateProvider } from '../AppStateProvider';
import { RootNavigator } from './RootNavigator';
import type { RootStackParamList } from './types';

type Route = {
  name: 'Main' | 'RequestDetail' | 'RejectReason';
  params?: { id: string };
};

const navigation = createNavigationContainerRef<RootStackParamList>();

const renderAt = (routes: Route[]) =>
  render(
    <AppStateProvider>
      <NavigationContainer
        ref={navigation}
        initialState={{ index: routes.length - 1, routes }}
      >
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

describe('RootNavigator — VoiceOver escape', () => {
  const escapeTarget = (title: string) => {
    let node = screen.getByRole('header', { name: title }).parent;
    while (node && !node.props.onAccessibilityEscape) {
      node = node.parent;
    }
    return node;
  };

  it('아래 화면이 빠져 스택 첫 화면이 되면 escape 만 끄고 화면은 다시 만들지 않는다', async () => {
    await renderAt([
      { name: 'Main' },
      { name: 'RejectReason', params: { id: 'request-1' } },
    ]);
    const reason = () =>
      screen.getByRole('radio', { name: '일정이 맞지 않습니다' });
    await userEvent.press(reason());
    expect(escapeTarget('거절 사유')).not.toBeNull();

    // reset·딥링크처럼 아래 화면만 빠지고 거절 사유는 같은 화면으로 남는 경우
    await act(() =>
      navigation.dispatch(state =>
        CommonActions.reset({
          ...state,
          index: 0,
          routes: state.routes.slice(1),
        }),
      ),
    );
    // 레이아웃은 화면이 다시 그려질 때 판정한다
    await act(() =>
      navigation.dispatch({
        ...CommonActions.setParams({ id: 'request-1' }),
        source: navigation.getCurrentRoute()?.key,
      }),
    );

    expect(escapeTarget('거절 사유')).toBeNull();
    expect(reason()).toBeChecked();
  });
});
