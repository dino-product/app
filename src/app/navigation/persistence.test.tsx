import { render, screen, userEvent } from '@testing-library/react-native';
import { appStorage, isRecord } from '../../shared/storage/appStorage';
import App from '../App';
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

describe('내비게이션 상태 저장', () => {
  describe('저장한 상태 확인', () => {
    it('지금 앱 구조에 맞는 상태는 그대로 쓴다', () => {
      expect(parseSavedNavigation(saved(homeDetailState), NOW)).toEqual(
        homeDetailState,
      );
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

    it('바깥에서 하위 화면을 고른 파라미터(내 일정 › 응답 필요, 마이 › 조직 참여)는 받는다', () => {
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
                    {
                      name: 'OrgRoleSelect',
                      params: {
                        organizationId: 'org-1',
                        organizationName: 'Orbit',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ]);

      expect(parseSavedNavigation(saved(state), NOW)).toEqual(state);
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

    it('상태가 없으면(내비게이터가 사라짐) 저장하지 않는다', () => {
      saveNavigationState(undefined);

      expect(appStorage.contains(NAVIGATION_STATE_KEY)).toBe(false);
    });

    // 복원한 화면을 그리다 앱이 죽으면 다음 실행은 첫 화면부터 연다. 같은 화면에서 계속 죽지 않게 한다
    it('시작할 때 읽은 상태는 저장소에서 뺀다', () => {
      saveNavigationState(homeDetailState as never);

      expect(takeNavigationState()).toEqual(homeDetailState);
      expect(appStorage.contains(NAVIGATION_STATE_KEY)).toBe(false);
      expect(takeNavigationState()).toBeUndefined();
    });
  });

  // 화면을 더하거나 이름을 바꾸고 검증표를 그대로 두면, 저장한 상태를 늘 버리거나 틀린 상태를 받는다
  it('검증표가 실제 내비게이터의 화면 이름과 같다', async () => {
    await render(<App />);
    for (const name of ['내 일정', '작업 이력', '마이', '홈']) {
      await userEvent.press(screen.getByRole('tab', { name }));
    }
    const rendered = JSON.parse(
      appStorage.getString(NAVIGATION_STATE_KEY) ?? 'null',
    ).state;

    const compare = (state: unknown, schema: NavigatorSchema, path: string) => {
      if (!isRecord(state) || !Array.isArray(state.routes)) {
        throw new Error(`${path} 상태가 없다`);
      }
      expect({ path, names: state.routeNames }).toEqual({
        path,
        names: Object.keys(schema),
      });
      for (const route of state.routes) {
        const child = schema[route.name]?.navigator;
        if (child) {
          compare(route.state, child, `${path} › ${route.name}`);
        }
      }
    };
    compare(rendered, navigationSchema, 'Root');
  });
});
