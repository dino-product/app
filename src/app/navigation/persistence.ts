import {
  useNavigationContainerRef,
  type InitialState,
  type NavigationState,
} from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  appStorage,
  isRecord,
  readJson,
  writeJson,
} from '../../shared/storage/appStorage';
import type { RootStackParamList } from './types';

// 보던 화면(열린 화면 스택과 고른 탭)을 기기에 남겼다가 앱을 다시 열 때 복원한다 (#34).
// iOS·Android 는 백그라운드 앱을 예고 없이 종료하고, JS 는 그 순간을 알 수 없어 화면이 바뀔 때마다 저장한다.
// 그래서 사용자가 앱 전환기에서 직접 종료해도(OS 가 앱에 구분해 알려 주지 않는다) 복원한다.
// 대신 오래된 화면은 다시 열지 않는다. 다음 날 아침 어제 보던 상세로 시작하지 않게 첫 화면으로 돌아간다.
// React Navigation "State persistence" 가이드의 initialState·onStateChange 방식이다. 딥링크를 붙이면 링크로 열 때는 복원하지 않는다
export const NAVIGATION_STATE_KEY = 'navigation.state';
export const NAVIGATION_STATE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

type SavedNavigation = { savedAt: number; state: NavigationState };

// 저장한 상태가 지금 앱 구조와 맞는지 보는 검증표. 화면 이름은 내비게이터의 선언 순서와 같다.
// 화면을 더하거나 이름·파라미터를 바꾸면 여기도 바꾼다 (persistence.test 가 실제 내비게이터와 비교한다).
// 앱 업데이트로 구조가 바뀌어 맞지 않으면 상태를 통째로 버리고 첫 화면으로 시작한다.
// React Navigation 은 모르는 화면만 빼고 나머지를 살리지만, 반쯤 남은 스택보다 첫 화면이 덜 헷갈린다
type ScreenSchema = {
  params: (params: unknown) => boolean;
  navigator?: NavigatorSchema;
};
export type NavigatorSchema = Readonly<Record<string, ScreenSchema>>;

const hasScreen = (navigator: NavigatorSchema, name: unknown) =>
  typeof name === 'string' &&
  Object.prototype.hasOwnProperty.call(navigator, name);

const stringFields =
  (...keys: string[]) =>
  (params: unknown) =>
    isRecord(params) && keys.every(key => typeof params[key] === 'string');
const noParams = (params: unknown) => params === undefined;
const byId = { params: stringFields('id') };
const once = { params: noParams };

// 하위 내비게이터를 가진 화면의 파라미터 (NavigatorScreenParams). 바깥에서 하위 화면을 골라 열 때 쓴다
const nested = (navigator: NavigatorSchema): ScreenSchema => ({
  navigator,
  params: params => {
    if (params === undefined) {
      return true;
    }
    if (!isRecord(params) || !hasScreen(navigator, params.screen)) {
      return false;
    }
    return navigator[params.screen as string].params(params.params);
  },
});

const homeStack: NavigatorSchema = { WorkHome: once, WorkDetail: byId };
const historyStack: NavigatorSchema = {
  WorkHistory: once,
  CompletedWorkDetail: byId,
};
const byRequest = { params: stringFields('requestId') };
const myStack: NavigatorSchema = {
  MyPage: once,
  ProfileEdit: once,
  NotificationSettings: once,
  NotificationCenter: once,
  Terms: once,
  Account: once,
  Withdrawal: once,
  WithdrawalBlocked: once,
  OrgJoin: once,
  OrgRoleSelect: { params: stringFields('organizationId', 'organizationName') },
  OrgJoinRequested: byRequest,
  OrgJoinRejected: byRequest,
  OrgJoinRequests: once,
};
const mainTabs: NavigatorSchema = {
  home: nested(homeStack),
  // 바깥에서 고른 하위 탭(응답 필요). 화면이 옮긴 뒤 지워 빈 객체로 남는다
  schedule: {
    params: params =>
      params === undefined ||
      (isRecord(params) &&
        (params.tab === undefined || params.tab === 'pending')),
  },
  history: nested(historyStack),
  my: nested(myStack),
};
export const navigationSchema: NavigatorSchema = {
  Main: nested(mainTabs),
  RequestDetail: byId,
  RejectReason: byId,
};

function isValidState(state: unknown, navigator: NavigatorSchema): boolean {
  if (!isRecord(state) || !Array.isArray(state.routes)) {
    return false;
  }
  const { index, routes } = state;
  if (
    routes.length === 0 ||
    (index !== undefined &&
      !(Number.isInteger(index) && Number(index) < routes.length))
  ) {
    return false;
  }
  return routes.every(route => isValidRoute(route, navigator));
}

function isValidRoute(route: unknown, navigator: NavigatorSchema): boolean {
  if (!isRecord(route) || !hasScreen(navigator, route.name)) {
    return false;
  }
  const screen = navigator[route.name as string];
  if (!screen.params(route.params)) {
    return false;
  }
  if (route.state === undefined) {
    return true;
  }
  return (
    screen.navigator !== undefined &&
    isValidState(route.state, screen.navigator)
  );
}

/** 저장한 값이 지금 구조에 맞고 오래되지 않았으면 복원할 상태를 돌려준다 */
export function parseSavedNavigation(
  value: unknown,
  now: number,
): InitialState | undefined {
  if (!isRecord(value) || typeof value.savedAt !== 'number') {
    return undefined;
  }
  const age = now - value.savedAt;
  if (age < 0 || age > NAVIGATION_STATE_MAX_AGE_MS) {
    return undefined;
  }
  return isValidState(value.state, navigationSchema)
    ? (value.state as InitialState)
    : undefined;
}

/**
 * 시작할 때 저장한 상태를 꺼내고 저장소에서는 지운다. 복원한 화면이 다 그려지면(onReady) 다시 저장한다.
 * 복원한 화면을 그리다 앱이 죽으면 다음 실행은 첫 화면부터 열어, 같은 화면에서 계속 죽지 않게 한다
 */
export function takeNavigationState(): InitialState | undefined {
  const state = readJson(NAVIGATION_STATE_KEY, value =>
    parseSavedNavigation(value, Date.now()),
  );
  appStorage.remove(NAVIGATION_STATE_KEY);
  return state;
}

export function saveNavigationState(state: NavigationState | undefined) {
  if (state) {
    writeJson(NAVIGATION_STATE_KEY, {
      savedAt: Date.now(),
      state,
    } satisfies SavedNavigation);
  }
}

/** NavigationContainer 에 그대로 넘긴다 */
export function useNavigationPersistence() {
  const ref = useNavigationContainerRef<RootStackParamList>();
  // 첫 렌더 전에 한 번만 읽는다. 동기 저장소라 첫 화면을 기다리게 하지 않는다
  const [initialState] = useState(takeNavigationState);
  const onReady = useCallback(
    () => saveNavigationState(ref.getRootState()),
    [ref],
  );
  return {
    ref,
    initialState,
    onReady,
    onStateChange: saveNavigationState,
  };
}
