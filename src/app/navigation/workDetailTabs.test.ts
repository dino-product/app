import { mainTabsOf, workDetailInTabs } from './workDetailTabs';

// #221 리뷰: 작업 상세는 홈 탭과 내 일정 탭 스택에 쌓인다. 다른 탭에 같은 작업 상세가 이미 있으면 새로 쌓지 않고 그 화면으로 간다
const tabs = {
  index: 0,
  routes: [
    {
      name: 'home',
      state: {
        index: 1,
        routes: [
          { name: 'WorkHome' },
          { name: 'WorkDetail', params: { id: '7', organizationId: '3' } },
        ],
      },
    },
    {
      name: 'schedule',
      state: {
        index: 1,
        routes: [
          { name: 'MySchedule' },
          { name: 'WorkDetail', params: { id: '9' } },
        ],
      },
    },
    { name: 'history' },
    { name: 'my' },
  ],
};

describe('workDetailInTabs', () => {
  it('다른 탭에 같은 작업 상세가 없으면 고른 탭에 쌓는다 (아직 연 적 없는 탭이면 그 아래에 첫 화면)', () => {
    expect(workDetailInTabs(tabs, 'home', { id: '9x' })).toEqual({
      screen: 'home',
      params: { screen: 'WorkDetail', params: { id: '9x' }, initial: false },
    });
    expect(workDetailInTabs(undefined, 'schedule', { id: '7' })).toEqual({
      screen: 'schedule',
      params: { screen: 'WorkDetail', params: { id: '7' }, initial: false },
    });
  });

  it('내 일정 탭에 같은 작업 상세가 있으면 홈에 쌓지 않고 그 화면으로 간다', () => {
    expect(workDetailInTabs(tabs, 'home', { id: '9' })).toEqual({
      screen: 'schedule',
      params: { screen: 'WorkDetail', params: { id: '9' }, initial: false },
    });
  });

  it('홈 탭에 같은 작업 상세가 있으면 그 화면의 파라미터(발주사)를 그대로 두고 그 화면으로 간다', () => {
    expect(workDetailInTabs(tabs, 'schedule', { id: '7' })).toEqual({
      screen: 'home',
      params: {
        screen: 'WorkDetail',
        params: { id: '7', organizationId: '3' },
        initial: false,
      },
    });
  });

  it('고른 탭에 이미 있으면 고른 탭이다 (같은 스택 안에서는 getId 가 같은 화면으로 간다)', () => {
    expect(workDetailInTabs(tabs, 'home', { id: '7' }).screen).toBe('home');
  });
});

describe('mainTabsOf', () => {
  it('루트 상태에서 메인 탭 상태를 꺼낸다', () => {
    expect(
      mainTabsOf({ routes: [{ name: 'Main', state: tabs }] } as never),
    ).toBe(tabs);
    expect(mainTabsOf({ routes: [{ name: 'Login' }] } as never)).toBe(
      undefined,
    );
    expect(mainTabsOf(undefined)).toBeUndefined();
  });
});
