import { screen, userEvent } from '@testing-library/react-native';
import { appStorage, isRecord } from '../../shared/storage/appStorage';
import { accountServer, renderApp, renderSignedInApp } from '../testing';
import {
  NAVIGATION_STATE_KEY,
  NAVIGATION_STATE_MAX_AGE_MS,
  navigationSchema,
  parseSavedNavigation,
  saveNavigationState,
  takeNavigationState,
  type NavigatorSchema,
} from './persistence';

const NOW = Date.UTC(2026, 10, 3, 9, 0);

// onStateChange 가 주는 것과 같은 모양 (key·routeNames·stale 이 있는 전체 상태)
const homeDetailState = {
  stale: false,
  type: 'stack',
  key: 'stack-root',
  index: 0,
  routeNames: ['Main', 'RequestDetail', 'RejectReason'],
  routes: [
    {
      key: 'Main-1',
      name: 'Main',
      state: {
        stale: false,
        type: 'tab',
        key: 'tab-1',
        index: 0,
        routeNames: ['home', 'schedule', 'history', 'my'],
        history: [{ type: 'route', key: 'home-1' }],
        routes: [
          {
            key: 'home-1',
            name: 'home',
            state: {
              stale: false,
              type: 'stack',
              key: 'stack-home',
              index: 1,
              routeNames: ['WorkHome', 'WorkDetail'],
              routes: [
                { key: 'WorkHome-1', name: 'WorkHome' },
                {
                  key: 'WorkDetail-1',
                  name: 'WorkDetail',
                  params: { id: 'w1' },
                },
              ],
            },
          },
          { key: 'schedule-1', name: 'schedule' },
          { key: 'history-1', name: 'history' },
          { key: 'my-1', name: 'my' },
        ],
      },
    },
  ],
};

const saved = (state: unknown, savedAt = NOW) => ({ savedAt, state });

// 홈 탭 스택만 바꾼 상태
const withHomeRoutes = (routes: unknown[], index = routes.length - 1) => {
  const state: typeof homeDetailState = JSON.parse(
    JSON.stringify(homeDetailState),
  );
  const home = state.routes[0].state.routes[0] as { state: unknown };
  home.state = { index, routes };
  return state;
};

const withRoot = (routes: unknown[]) => ({ index: 0, routes });

// 마이 탭 스택만 바꾼 상태
const withMyRoutes = (routes: unknown[]) =>
  withRoot([
    {
      name: 'Main',
      state: {
        index: 0,
        routes: [
          {
            name: 'my',
            state: { index: routes.length - 1, routes },
          },
        ],
      },
    },
  ]);
const orbitTarget = {
  organizationId: '9',
  organizationName: 'Orbit',
  companyCode: 'RBT124',
  requestChannel: 'COMPANY_CODE',
};

describe('내비게이션 상태 저장', () => {
  describe('저장한 상태 확인', () => {
    it('지금 앱 구조에 맞는 상태는 그대로 쓴다', () => {
      expect(parseSavedNavigation(saved(homeDetailState), NOW)).toEqual(
        homeDetailState,
      );
    });

    // #117: 알림에서 연 작업 상세는 발주사도 들고 있다
    it('발주사를 든 작업 상세도 그대로 쓴다', () => {
      const state = withHomeRoutes([
        { name: 'WorkHome' },
        { name: 'WorkDetail', params: { id: 'w1', organizationId: '7' } },
      ]);

      expect(parseSavedNavigation(saved(state), NOW)).toEqual(state);
    });

    it.each([
      ['없는 루트 화면', withRoot([{ name: 'OldScreen' }])],
      [
        '없는 탭 안 화면',
        withHomeRoutes([{ name: 'WorkHome' }, { name: 'OldDetail' }]),
      ],
      ['id 가 없는 작업 상세', withHomeRoutes([{ name: 'WorkDetail' }])],
      [
        'id 가 문자열이 아닌 작업 상세',
        withHomeRoutes([{ name: 'WorkDetail', params: { id: 1 } }]),
      ],
      [
        '발주사가 문자열이 아닌 작업 상세 (#117)',
        withHomeRoutes([
          { name: 'WorkDetail', params: { id: 'w1', organizationId: 7 } },
        ]),
      ],
      [
        '파라미터가 없어야 하는 화면에 파라미터',
        withHomeRoutes([{ name: 'WorkHome', params: { id: 'w1' } }]),
      ],
      [
        '하위 내비게이터가 없는 화면에 하위 상태',
        withRoot([
          {
            name: 'RequestDetail',
            params: { id: 'request-1' },
            state: { routes: [{ name: 'WorkHome' }] },
          },
        ]),
      ],
      // 참여 요청은 회사 코드로 보낸다 (#116). 그 전에 저장한 역할 선택(회사 id·이름만)은 열 수 없다
      [
        '회사 코드가 없는 역할 선택',
        withMyRoutes([
          { name: 'MyPage' },
          {
            name: 'OrgRoleSelect',
            params: { organizationId: 'org-1', organizationName: 'Orbit' },
          },
        ]),
      ],
      [
        '찾은 방법이 목록 밖인 역할 선택',
        withMyRoutes([
          { name: 'MyPage' },
          {
            name: 'OrgRoleSelect',
            params: { ...orbitTarget, requestChannel: 'EMAIL' },
          },
        ]),
      ],
      [
        '요청 경로가 목록 밖인 요청 완료',
        withMyRoutes([
          { name: 'MyPage' },
          {
            name: 'OrgJoinRequested',
            params: { requestId: '3', requestChannel: 'EMAIL' },
          },
        ]),
      ],
      // 다시 열자마자 카메라를 켜지 않는다 (#108)
      [
        'QR 코드 인식 화면이 든 상태',
        withRoot([{ name: 'Main' }, { name: 'OrgQrScan' }]),
      ],
      ['범위 밖 index', withHomeRoutes([{ name: 'WorkHome' }], 3)],
      ['빈 routes', withHomeRoutes([])],
      ['routes 가 배열이 아님', { routes: 'Main' }],
      [
        '없는 하위 탭으로 여는 파라미터',
        withRoot([{ name: 'Main', params: { screen: 'settings' } }]),
      ],
      [
        '하위 화면 파라미터가 틀린 파라미터',
        withRoot([
          {
            name: 'Main',
            params: { screen: 'home', params: { screen: 'WorkDetail' } },
          },
        ]),
      ],
      [
        '내 일정 하위 탭 값이 없는 값',
        withRoot([
          {
            name: 'Main',
            params: { screen: 'schedule', params: { tab: 'done' } },
          },
        ]),
      ],
    ])('구조가 맞지 않으면 버린다: %s', (_name, state) => {
      expect(parseSavedNavigation(saved(state), NOW)).toBeUndefined();
    });

    // 하위 내비게이터는 남은 하위 이동 파라미터를 저장한 하위 상태보다 먼저 써서 화면을 다시 만든다 (useNavigationBuilder).
    // 이미 하위 상태에 반영된 것이라 지운다
    it('바깥에서 하위 화면을 고른 파라미터(내 일정 › 응답 필요, 마이 › 조직 참여)는 받되, 하위 상태가 있으면 지운다', () => {
      const state = withRoot([
        {
          name: 'Main',
          params: { screen: 'schedule', params: { tab: 'pending' } },
          state: {
            index: 3,
            routes: [
              { name: 'home' },
              { name: 'schedule', params: {} },
              { name: 'history' },
              {
                name: 'my',
                state: {
                  index: 2,
                  routes: [
                    { name: 'MyPage' },
                    { name: 'OrgJoin' },
                    { name: 'OrgRoleSelect', params: orbitTarget },
                  ],
                },
              },
            ],
          },
        },
      ]);

      const restored = JSON.parse(JSON.stringify(state));
      delete restored.routes[0].params;

      expect(parseSavedNavigation(saved(state), NOW)).toEqual(restored);
    });

    it('요청 완료는 요청 경로가 있어도 없어도 연다 (경로는 이 앱이 보낸 요청에만 있다)', () => {
      for (const params of [
        { requestId: '3' },
        { requestId: '101', requestChannel: 'COMPANY_CODE' },
      ]) {
        const state = withMyRoutes([
          { name: 'MyPage' },
          { name: 'OrgJoinRequested', params },
        ]);

        expect(parseSavedNavigation(saved(state), NOW)).toEqual(state);
      }
    });

    it('하위 상태가 없으면(아직 열지 않은 하위 내비게이터) 하위 이동 파라미터를 남긴다', () => {
      const state = withRoot([
        {
          name: 'Main',
          params: {
            screen: 'home',
            params: { screen: 'WorkDetail', params: { id: 'w1' } },
          },
        },
      ]);

      expect(parseSavedNavigation(saved(state), NOW)).toEqual(state);
    });

    it('하위 이동 키 말고 다른 파라미터는 남긴다', () => {
      const state = withHomeRoutes([{ name: 'WorkHome' }]);
      const home = state.routes[0].state.routes[0] as Record<string, unknown>;
      home.params = { screen: 'WorkHome', initial: false };
      const tabs = state.routes[0].state.routes;
      (tabs[1] as Record<string, unknown>).params = { tab: 'pending' };

      const restored = parseSavedNavigation(saved(state), NOW) as typeof state;

      expect(restored.routes[0].state.routes[0]).not.toHaveProperty('params');
      expect(restored.routes[0].state.routes[1]).toHaveProperty('params', {
        tab: 'pending',
      });
    });

    it(`마지막 저장 뒤 ${
      NAVIGATION_STATE_MAX_AGE_MS / 3_600_000
    }시간이 지난 상태는 버린다`, () => {
      expect(
        parseSavedNavigation(
          saved(homeDetailState, NOW - NAVIGATION_STATE_MAX_AGE_MS),
          NOW,
        ),
      ).toEqual(homeDetailState);
      expect(
        parseSavedNavigation(
          saved(homeDetailState, NOW - NAVIGATION_STATE_MAX_AGE_MS - 1),
          NOW,
        ),
      ).toBeUndefined();
    });

    it('저장 시각이 없거나 앞날이면(기기 시계 변경) 버린다', () => {
      expect(
        parseSavedNavigation({ state: homeDetailState }, NOW),
      ).toBeUndefined();
      expect(
        parseSavedNavigation(saved(homeDetailState, NOW + 60_000), NOW),
      ).toBeUndefined();
    });
  });

  describe('읽기·쓰기', () => {
    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(NOW);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('저장한 상태를 저장 시각과 함께 남긴다', () => {
      saveNavigationState(homeDetailState as never);

      expect(
        JSON.parse(appStorage.getString(NAVIGATION_STATE_KEY) ?? ''),
      ).toEqual(saved(homeDetailState));
    });

    it('저장 시각을 주면 그 시각으로 남긴다 (복원만 한 상태를 다시 남길 때)', () => {
      saveNavigationState(homeDetailState as never, NOW - 1000);

      expect(
        JSON.parse(appStorage.getString(NAVIGATION_STATE_KEY) ?? ''),
      ).toEqual(saved(homeDetailState, NOW - 1000));
    });

    it('상태가 없으면(내비게이터가 사라짐) 저장하지 않는다', () => {
      saveNavigationState(undefined);

      expect(appStorage.contains(NAVIGATION_STATE_KEY)).toBe(false);
    });

    // 복원한 화면을 그리다 앱이 죽으면 다음 실행은 첫 화면부터 연다. 같은 화면에서 계속 죽지 않게 한다
    it('시작할 때 읽은 상태는 저장소에서 뺀다', () => {
      saveNavigationState(homeDetailState as never);

      expect(takeNavigationState()).toEqual({
        state: homeDetailState,
        savedAt: NOW,
      });
      expect(appStorage.contains(NAVIGATION_STATE_KEY)).toBe(false);
      expect(takeNavigationState()).toBeUndefined();
    });
  });

  // 화면을 더하거나 이름을 바꾸고 검증표를 그대로 두면, 저장한 상태를 늘 버리거나 틀린 상태를 받는다.
  // 루트는 로그인 상태에 따라 화면 묶음(로그인 / 가입 단계 / 메인)만 그리므로(#85, #113), 세 상태로 그려 루트 화면 이름을 합친다
  it('검증표가 실제 내비게이터의 화면 이름과 같다', async () => {
    const savedState = () =>
      JSON.parse(appStorage.getString(NAVIGATION_STATE_KEY) ?? 'null').state;

    const signedOut = await renderApp({
      server: accountServer({ nextStep: 'PROFILE' }),
    });
    const login = savedState();
    await userEvent.press(
      screen.getByRole('button', { name: '카카오로 시작하기' }),
    );
    await screen.findByRole('header', { name: '프로필 등록' });
    const onboarding = savedState();
    await signedOut.unmount();
    appStorage.clearAll();

    await renderSignedInApp();
    for (const name of ['내 일정', '작업 이력', '마이', '홈']) {
      await userEvent.press(screen.getByRole('tab', { name }));
    }
    const main = savedState();

    const compareRoutes = (
      state: unknown,
      schema: NavigatorSchema,
      path: string,
    ) => {
      if (!isRecord(state) || !Array.isArray(state.routes)) {
        throw new Error(`${path} 상태가 없다`);
      }
      for (const route of state.routes) {
        const routePath = `${path} › ${route.name}`;
        const child = schema[route.name]?.navigator;
        // 하위 내비게이터가 있는 화면은 검증표에도 하위 검증표가 있어야 한다
        expect({ path: routePath, nested: child !== undefined }).toEqual({
          path: routePath,
          nested: route.state !== undefined,
        });
        if (child) {
          compare(route.state, child, routePath);
        }
      }
    };
    const compare = (state: unknown, schema: NavigatorSchema, path: string) => {
      if (!isRecord(state)) {
        throw new Error(`${path} 상태가 없다`);
      }
      expect({ path, names: state.routeNames }).toEqual({
        path,
        names: Object.keys(schema),
      });
      compareRoutes(state, schema, path);
    };

    expect([
      ...login.routeNames,
      ...onboarding.routeNames,
      ...main.routeNames,
    ]).toEqual(Object.keys(navigationSchema));
    compareRoutes(login, navigationSchema, 'Root(로그아웃)');
    compareRoutes(onboarding, navigationSchema, 'Root(가입 단계)');
    compareRoutes(main, navigationSchema, 'Root(로그인)');
  });
});
