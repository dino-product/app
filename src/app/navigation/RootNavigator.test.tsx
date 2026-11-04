import {
  CommonActions,
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { escapeTarget } from '../../../jest/voiceOver';
import { saveSignedInStep } from '../../features/onboarding/login';
import { WorkRepositoryProvider } from '../../features/work/data/WorkRepositoryProvider';
import { ApiProvider } from '../../shared/api';
import { createTestApi } from '../../shared/testing/renderWithApi';
import { AuthProvider } from '../AuthProvider';
import { accountServer, signedInSession, testWorkRepository } from '../testing';
import { RootNavigator } from './RootNavigator';
import type { RootStackParamList } from './types';

type Route = {
  name: 'Main' | 'RequestDetail' | 'RejectReason';
  params?: { id: string };
};

const navigation = createNavigationContainerRef<RootStackParamList>();

// 작업은 로컬 작업 저장소의 처음 데이터다 (응답 필요 요청 104, 완료 작업 1)
const PENDING_ID = '104';
const COMPLETED_ID = '1';

// 가입을 마친 계정으로 로그인해 둔 기기(가짜 서버, 저장된 세션과 가입 단계 표식)에서 내비게이터를 그린다
function renderSignedIn(navigator: ReactNode) {
  saveSignedInStep('COMPLETED');
  const api = createTestApi({
    server: accountServer(),
    session: signedInSession(),
  });
  return render(
    <ApiProvider client={api.client} queryClient={api.queryClient}>
      <WorkRepositoryProvider repository={testWorkRepository()}>
        <AuthProvider>{navigator}</AuthProvider>
      </WorkRepositoryProvider>
    </ApiProvider>,
  );
}

const renderAt = (routes: Route[]) =>
  renderSignedIn(
    <NavigationContainer
      ref={navigation}
      initialState={{ index: routes.length - 1, routes }}
    >
      <RootNavigator />
    </NavigationContainer>,
  );

const unavailable = () => screen.findByText('볼 수 없는 작업이에요');

// 볼 수 없는 요청(이미 처리됐거나 서버에서 취소·재배정됨, SCHEDULE-001)으로 화면이 열린 경우
describe('RootNavigator — 볼 수 없는 요청', () => {
  it('요청 상세는 "볼 수 없는 작업이에요" 를 보이고, 뒤로 가면 이전 화면이다', async () => {
    await renderAt([
      { name: 'Main' },
      { name: 'RequestDetail', params: { id: 'missing' } },
    ]);

    expect(await unavailable()).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(
      await screen.findByRole('header', { name: '내 작업' }),
    ).toBeOnTheScreen();
  });

  it('거절 사유는 빈 화면 대신 이전 화면으로 돌아간다', async () => {
    await renderAt([
      { name: 'Main' },
      { name: 'RejectReason', params: { id: 'missing' } },
    ]);

    expect(
      await screen.findByRole('header', { name: '내 작업' }),
    ).toBeOnTheScreen();
  });

  it('돌아갈 화면이 없으면(딥링크로 바로 열림) 뒤로 가기가 탭 첫 화면으로 바꾼다', async () => {
    await renderAt([{ name: 'RequestDetail', params: { id: 'missing' } }]);

    expect(await unavailable()).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(
      await screen.findByRole('header', { name: '내 작업' }),
    ).toBeOnTheScreen();
  });
});

// 작업 이력 탭 안의 스택(목록 › 완료 작업 상세)을 바로 연다
const renderHistoryAt = (
  routes: {
    name: 'WorkHistory' | 'CompletedWorkDetail';
    params?: { id: string };
  }[],
) =>
  renderSignedIn(
    <NavigationContainer
      initialState={{
        routes: [
          {
            name: 'Main',
            state: {
              routes: [
                {
                  name: 'history',
                  state: { index: routes.length - 1, routes },
                },
              ],
            },
          },
        ],
      }}
    >
      <RootNavigator />
    </NavigationContainer>,
  );

describe('RootNavigator — 볼 수 없는 완료 작업', () => {
  it('완료 작업 상세는 "볼 수 없는 작업이에요" 를 보이고, 뒤로 가면 작업 이력 목록이다', async () => {
    await renderHistoryAt([
      { name: 'WorkHistory' },
      { name: 'CompletedWorkDetail', params: { id: 'missing' } },
    ]);

    expect(await unavailable()).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(
      await screen.findByRole('header', { name: '작업 이력' }),
    ).toBeOnTheScreen();
  });

  it('돌아갈 화면이 없으면(딥링크로 바로 열림) 뒤로 가기가 작업 이력 목록으로 바꾼다', async () => {
    await renderHistoryAt([
      { name: 'CompletedWorkDetail', params: { id: 'missing' } },
    ]);

    expect(await unavailable()).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(
      await screen.findByRole('header', { name: '작업 이력' }),
    ).toBeOnTheScreen();
  });
});

describe('RootNavigator — 완료되지 않은 작업으로 연 완료 작업 상세', () => {
  it('완료 보고가 없는 작업(작업전 101)은 읽기 전용 상세 대신 "볼 수 없는 작업이에요" 다', async () => {
    await renderHistoryAt([
      { name: 'WorkHistory' },
      { name: 'CompletedWorkDetail', params: { id: '101' } },
    ]);

    expect(await unavailable()).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: '완료보고 제출' }),
    ).not.toBeOnTheScreen();
  });
});

describe('RootNavigator — 딥링크로 바로 연 완료 작업 상세', () => {
  // 탭 안 스택 첫 화면이라 그냥 뒤로 가면 탭 내비게이터가 홈 탭으로 보낸다
  it('뒤로 가기를 누르면 홈이 아니라 작업 이력 목록으로 간다', async () => {
    await renderHistoryAt([
      { name: 'CompletedWorkDetail', params: { id: COMPLETED_ID } },
    ]);
    // 불러온 완료 작업 상세 (제출 후 읽기 전용)
    expect(await screen.findByText(/^제출 시각 /)).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(
      await screen.findByRole('header', { name: '작업 이력' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: '작업 이력' })).toBeSelected();
  });
});

describe('RootNavigator — VoiceOver escape', () => {
  it('아래 화면이 빠져 스택 첫 화면이 되면 escape 만 끄고 화면은 다시 만들지 않는다', async () => {
    await renderAt([
      { name: 'Main' },
      { name: 'RejectReason', params: { id: PENDING_ID } },
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
        ...CommonActions.setParams({ id: PENDING_ID }),
        source: navigation.getCurrentRoute()?.key,
      }),
    );

    expect(escapeTarget('거절 사유')).toBeNull();
    expect(reason()).toBeChecked();
  });
});
