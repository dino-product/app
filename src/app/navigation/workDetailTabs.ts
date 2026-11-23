import type {
  NavigationState,
  NavigatorScreenParams,
  PartialState,
} from '@react-navigation/native';
import { isRecord } from '../../shared/isRecord';
import type { MainTabParamList, WorkDetailParams } from './types';

// 작업 상세는 홈 탭(내 작업·알림)과 내 일정 탭(확정 일정, #221) 스택에 쌓인다. 같은 작업을 두 탭에 따로 열면 두 화면이
// 같은 기기 초안(work.reportDraft.<작업 id>)에 따로 써 서로 덮는다 (#226 리뷰). 그래서 다른 탭에 같은 작업 상세가 이미 열려
// 있으면 새로 쌓지 않고 그 탭의 그 화면으로 간다. 작업 상세가 하나뿐이라 입력·초안 저장·제출이 한 화면에서만 일어나고,
// 가려진 화면이 오래된 입력으로 초안을 덮을 일이 없다 (포커스 때 초안을 다시 읽는 방식은 가려진 화면이 남아 그 위험이 남는다).
// 작업 상세를 여는 곳(홈 작업 열기·홈 알림센터·마이 알림센터·푸시·내 일정 확정 일정)이 모두 이것을 거친다

/** 작업 상세를 쌓는 탭 */
export type WorkDetailTab = 'home' | 'schedule';

type State = NavigationState | PartialState<NavigationState>;

const OTHER_TAB = { home: 'schedule', schedule: 'home' } as const;

/** 루트 상태에서 메인 탭 내비게이터의 상태. 메인에 들어가기 전(로그인·가입 중)이면 없다 */
export function mainTabsOf(root: State | undefined): State | undefined {
  return root?.routes.find(route => route.name === 'Main')?.state;
}

/** 그 탭 스택에 쌓인 작업 id 의 작업 상세 파라미터. 탭을 아직 열지 않았거나 없으면 undefined */
function openedIn(
  tabs: State | undefined,
  tab: WorkDetailTab,
  id: string,
): WorkDetailParams | undefined {
  const stack = tabs?.routes.find(route => route.name === tab)?.state;
  const route = stack?.routes.find(
    item =>
      item.name === 'WorkDetail' &&
      isRecord(item.params) &&
      item.params.id === id,
  );
  return route?.params as WorkDetailParams | undefined;
}

/**
 * 메인 탭 내비게이터에서 작업 상세로 가는 파라미터. preferred 탭에 쌓되, 그 탭에는 없고 다른 탭에 같은 작업 상세가 있으면
 * 그 탭의 그 화면이다 (그 화면의 파라미터를 그대로 써 발주사 등이 바뀌지 않는다). 아직 연 적 없는 탭이면 그 아래에 첫 화면을 둔다
 */
export function workDetailInTabs(
  tabs: State | undefined,
  preferred: WorkDetailTab,
  params: WorkDetailParams,
): NavigatorScreenParams<MainTabParamList> {
  const other = OTHER_TAB[preferred];
  const opened = openedIn(tabs, preferred, params.id)
    ? undefined
    : openedIn(tabs, other, params.id);
  const tab = opened ? other : preferred;
  const target = opened ?? params;
  return tab === 'home'
    ? {
        screen: 'home',
        params: { screen: 'WorkDetail', params: target, initial: false },
      }
    : {
        screen: 'schedule',
        params: { screen: 'WorkDetail', params: target, initial: false },
      };
}
