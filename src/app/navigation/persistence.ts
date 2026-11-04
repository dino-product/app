import {
  useNavigationContainerRef,
  type InitialState,
  type NavigationState,
} from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { requestChannelLabels } from '../../features/my/org/model';
import {
  appStorage,
  isRecord,
  readJson,
  writeJson,
} from '../../shared/storage/appStorage';
import type {
  HistoryStackParamList,
  HomeStackParamList,
  MainTabParamList,
  MyStackParamList,
  OnboardingStackParamList,
  RootStackParamList,
} from './types';

// 보던 화면(열린 화면 스택과 고른 탭)을 기기에 남겼다가 앱을 다시 열 때 복원한다 (#34).
// iOS·Android 는 백그라운드 앱을 예고 없이 종료하고, JS 는 그 순간을 알 수 없어 화면이 바뀔 때마다 저장한다.
// 그래서 사용자가 앱 전환기에서 직접 종료해도(OS 가 앱에 구분해 알려 주지 않는다) 복원한다.
// 대신 마지막으로 화면이 바뀐 지 오래됐으면 다시 열지 않는다. 다음 날 아침 어제 보던 상세로 시작하지 않게 첫 화면으로 돌아간다.
// React Navigation "State persistence" 가이드의 initialState·onStateChange 방식이다.
// 딥링크·알림으로 여는 길을 붙이면 그때는 복원하지 않게 직접 막아야 한다. NavigationContainer 는 initialState 가 있으면 링크보다 그것을 쓴다
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

// 알림에서 연 작업 상세는 발주사도 들고 있다 (#117)
const workDetail = {
  params: (params: unknown) =>
    stringFields('id')(params) &&
    isRecord(params) &&
    (params.organizationId === undefined ||
      typeof params.organizationId === 'string'),
};

// satisfies 로 화면 이름 빠짐·남음은 컴파일 때 잡는다. 파라미터 모양은 검사기가 본다
const homeStack = {
  WorkHome: once,
  WorkDetail: workDetail,
  NotificationCenter: once,
} satisfies Record<keyof HomeStackParamList, ScreenSchema>;
const historyStack = {
  WorkHistory: once,
  CompletedWorkDetail: byId,
} satisfies Record<keyof HistoryStackParamList, ScreenSchema>;
const byRequest = { params: stringFields('requestId') };
// 회사 참여 (#116). 참여 요청은 회사 코드와 찾은 방법으로 보내고, 요청 경로는 이 앱이 보낸 요청에만 있다
const isRequestChannel = (value: unknown) =>
  typeof value === 'string' &&
  Object.prototype.hasOwnProperty.call(requestChannelLabels, value);
const joinTarget = {
  params: (params: unknown) =>
    stringFields('organizationId', 'organizationName', 'companyCode')(params) &&
    isRecord(params) &&
    isRequestChannel(params.requestChannel),
};
const joinRequest = {
  params: (params: unknown) =>
    byRequest.params(params) &&
    isRecord(params) &&
    (params.requestChannel === undefined ||
      isRequestChannel(params.requestChannel)),
};
const myStack = {
  MyPage: once,
  ProfileEdit: once,
  NotificationSettings: once,
  NotificationCenter: once,
  Terms: once,
  Account: once,
  Withdrawal: once,
  WithdrawalBlocked: once,
  OrgJoin: once,
  OrgRoleSelect: joinTarget,
  OrgJoinRequested: joinRequest,
  OrgJoinRejected: byRequest,
  OrgJoinRequests: once,
} satisfies Record<keyof MyStackParamList, ScreenSchema>;
const mainTabs = {
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
} satisfies Record<keyof MainTabParamList, ScreenSchema>;
// 가입 단계 (#85, #113). 어느 단계부터 열지는 다시 열 때 서버 프로필(nextStep)로 정하고, 진행(약관 체크·참여 요청)은
// 메모리에만 있다. 그래서 Onboarding 화면이 든 상태는 맞지 않는 것으로 보고 통째로 버린다. 하위 검증표는 구조를 적어 둔다
const onboardingStack = {
  ProfileRegister: once,
  TermsAgreement: once,
  CompanyFind: once,
  CompanyQrScan: once,
  JoinRoleSelect: joinTarget,
  JoinPending: joinRequest,
  JoinApproved: byRequest,
  JoinRejected: byRequest,
} satisfies Record<keyof OnboardingStackParamList, ScreenSchema>;
export const navigationSchema: NavigatorSchema = {
  Login: once,
  Onboarding: { navigator: onboardingStack, params: () => false },
  Main: nested(mainTabs),
  RequestDetail: byId,
  RejectReason: byId,
  // QR 코드 인식(#108)으로 다시 열면 앱을 켜자마자 카메라가 켜진다. 이 화면이 든 상태는 버리고 첫 화면으로 연다
  OrgQrScan: { params: () => false },
} satisfies Record<keyof RootStackParamList, ScreenSchema>;

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

// 바깥에서 하위 화면을 골라 옮긴 파라미터(navigate('home', { screen }) 등)의 키. NavigatorScreenParams 가 쓴다
const NESTED_NAVIGATION_KEYS = [
  'screen',
  'params',
  'initial',
  'state',
  'path',
  'merge',
  'pop',
];

// 하위 상태가 있는 화면에 남은 하위 이동 파라미터는 이미 그 상태에 반영된 것이다. 그대로 두면 다시 연 앱의 하위 내비게이터가
// 저장한 상태 대신 이 파라미터로 화면을 다시 만든다 (useNavigationBuilder 는 params.screen 을 먼저 쓰고, 이미 쓴 파라미터인지는
// 메모리에만 기억한다). 하위 상태가 없으면(아직 열지 않은 탭) 처음 열 때 쓸 파라미터라 남긴다
function withoutConsumedNestedParams(state: unknown): unknown {
  if (!isRecord(state) || !Array.isArray(state.routes)) {
    return state;
  }
  return {
    ...state,
    routes: state.routes.map((route: Record<string, unknown>) => {
      if (route.state === undefined) {
        return route;
      }
      const { params, ...rest } = route;
      const next = { ...rest, state: withoutConsumedNestedParams(route.state) };
      if (!isRecord(params)) {
        return next;
      }
      const kept = Object.fromEntries(
        Object.entries(params).filter(
          ([key]) => !NESTED_NAVIGATION_KEYS.includes(key),
        ),
      );
      return Object.keys(kept).length > 0 ? { ...next, params: kept } : next;
    }),
  };
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
    ? (withoutConsumedNestedParams(value.state) as InitialState)
    : undefined;
}

type RestoredNavigation = { state: InitialState; savedAt: number };

/**
 * 시작할 때 저장한 상태를 꺼내고 저장소에서는 지운다. 복원한 화면이 다 그려지면(onReady) 다시 저장한다.
 * 복원한 화면을 그리다 앱이 죽으면 다음 실행은 첫 화면부터 열어, 같은 화면에서 계속 죽지 않게 한다
 */
export function takeNavigationState(): RestoredNavigation | undefined {
  const restored = readJson(NAVIGATION_STATE_KEY, value => {
    const state = parseSavedNavigation(value, Date.now());
    // parseSavedNavigation 이 저장 시각을 확인했다
    return state && { state, savedAt: (value as SavedNavigation).savedAt };
  });
  appStorage.remove(NAVIGATION_STATE_KEY);
  return restored;
}

/** 저장한 화면을 지운다. 로그아웃·세션 만료 뒤 다시 열 때 앞 계정이 보던 화면으로 열지 않게 한다 (#113) */
export function clearNavigationState() {
  appStorage.remove(NAVIGATION_STATE_KEY);
}

/** savedAt 을 주지 않으면 지금 바뀐 것으로 남긴다 */
export function saveNavigationState(
  state: NavigationState | undefined,
  savedAt = Date.now(),
) {
  if (state) {
    writeJson(NAVIGATION_STATE_KEY, {
      savedAt,
      state,
    } satisfies SavedNavigation);
  }
}

const saveChangedState = (state: NavigationState | undefined) =>
  saveNavigationState(state);

/** NavigationContainer 에 그대로 넘긴다 */
export function useNavigationPersistence() {
  const ref = useNavigationContainerRef<RootStackParamList>();
  // 첫 렌더 전에 한 번만 읽는다. 동기 저장소라 첫 화면을 기다리게 하지 않는다.
  // 화면을 그리기 전에 지워야 하므로 렌더 중에 꺼낸다. 루트 위에 첫 렌더를 버리는 것(Suspense 등)을 두면 복원이 사라지니 다시 본다
  const [restored] = useState(takeNavigationState);
  // 복원만 하고 화면은 바뀌지 않았으니 처음 저장한 시각을 그대로 둔다. 열 때마다 기한이 늘어나지 않는다
  const restoredAt = restored?.savedAt;
  const onReady = useCallback(
    () => saveNavigationState(ref.getRootState(), restoredAt),
    [ref, restoredAt],
  );
  return {
    ref,
    initialState: restored?.state,
    onReady,
    onStateChange: saveChangedState,
  };
}
