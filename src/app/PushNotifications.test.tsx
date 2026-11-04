import { render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { enableFirebase, pushListenerCount } from '../../jest/firebase';
import { saveSignedInStep } from '../features/onboarding/login';
import { readPushDeviceId } from '../features/push/push';
import { WorkRepositoryProvider } from '../features/work/data/WorkRepositoryProvider';
import { createFakeServer, ok } from '../shared/testing/fakeServer';
import { createTestApi } from '../shared/testing/renderWithApi';
import { AuthProvider } from './AuthProvider';
import { PushNotifications } from './PushNotifications';
import { accountServer, signedInSession, testWorkRepository } from './testing';

// 앱 푸시 연결부의 구독 정리 (#118). 흐름은 App.push.test 가 본다

afterEach(() => {
  jest.restoreAllMocks();
});

it('내려가면 메시지 구독 셋(받기·열기·토큰 갱신)·내비게이션 구독 둘(ready·state)·앱 상태 구독을 모두 푼다', async () => {
  enableFirebase();
  saveSignedInStep('COMPLETED');
  const appStateRemoves: jest.Mock[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => {
    const remove = jest.fn();
    appStateRemoves.push(remove);
    return { remove };
  });
  const navigationUnsubscribes = [jest.fn(), jest.fn()];
  const navigation = {
    isReady: () => false,
    getRootState: () => undefined,
    getCurrentRoute: () => undefined,
    navigate: jest.fn(),
    addListener: jest
      .fn()
      .mockReturnValueOnce(navigationUnsubscribes[0])
      .mockReturnValueOnce(navigationUnsubscribes[1]),
  };
  const api = createTestApi({
    server: accountServer({
      server: createFakeServer().on(
        'POST',
        '/api/v1/push-devices',
        ok({ pushDeviceId: 7 }),
      ),
    }),
    session: signedInSession(),
  });

  const view = await render(
    <api.wrapper>
      <WorkRepositoryProvider repository={testWorkRepository()}>
        <AuthProvider>
          <PushNotifications navigation={navigation as never} />
        </AuthProvider>
      </WorkRepositoryProvider>
    </api.wrapper>,
  );
  await waitFor(() => expect(readPushDeviceId()).toBe(7));
  expect(pushListenerCount()).toBe(3);
  expect(navigation.addListener).toHaveBeenCalledTimes(2);

  await view.unmount();

  expect(pushListenerCount()).toBe(0);
  navigationUnsubscribes.forEach(unsubscribe =>
    expect(unsubscribe).toHaveBeenCalledTimes(1),
  );
  expect(appStateRemoves.length).toBeGreaterThan(0);
  appStateRemoves.forEach(remove => expect(remove).toHaveBeenCalledTimes(1));
});
