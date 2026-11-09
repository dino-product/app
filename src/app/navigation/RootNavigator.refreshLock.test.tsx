import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { swipeFrom } from '../../../jest/responder';
import type { WorkRepository } from '../../features/work/data/types';
import { SWITCH_DISTANCE } from '../../shared/gesture/tabSwipe';
import { autoHideHeaderOffset } from '../../shared/testing/autoHideHeader';
import { fixAppTestClock, renderSignedInHome } from '../testing';

// 새로고침이 도는 동안에는 탭을 옮기지 않는다 (#177). 옮기면 떠난 화면의 새로고침 표시·상단 바가 내려간 채 남았다.
// 탭 바 누름·좌우 밀기·Android 뒤로가기(홈 탭으로) 모두 같다. 끝나면(성공·실패) 바로 다시 옮길 수 있다
fixAppTestClock();
// 앱 전체를 그리는 흐름 테스트라 기본 5초보다 길게 둔다
jest.setTimeout(20_000);

type TabLabel = '홈' | '내 일정' | '작업 이력' | '마이';
const tab = (name: TabLabel) => screen.getByRole('tab', { name });
const expectSelected = (name: TabLabel) =>
  expect(screen.getByRole('tab', { name, selected: true })).toBeOnTheScreen();
const FAR = SWITCH_DISTANCE + 30;
const swipeTab = (name: string, dx: number) =>
  swipeFrom(
    screen.getByTestId(`tab-swipe-${name}`, { includeHiddenElements: true }),
    { from: { x: 200, y: 400 }, dx },
  );

type Read = 'getMySchedule' | 'getPendingWorks' | 'getWorkHistory';
/** 작업 저장소의 다음 조회 한 번을 붙잡아 둔다. 끝내면 원래 조회로 답하거나 실패한다 */
function holdNextRead(repository: WorkRepository, method: Read) {
  const original = repository[method].bind(repository) as (
    ...args: unknown[]
  ) => Promise<unknown>;
  let finish: (ok: boolean) => void = () => {};
  jest.spyOn(repository, method).mockImplementationOnce(
    ((...args: unknown[]) =>
      new Promise((resolve, reject) => {
        finish = ok =>
          ok ? resolve(original(...args)) : reject(new Error('network'));
      })) as never,
  );
  return {
    succeed: () => act(() => finish(true)),
    fail: () => act(() => finish(false)),
  };
}

/** 당겨서 새로고침을 시작한다. 붙잡아 둔 조회가 끝날 때까지 끝나지 않으므로 시작만 하고 기다리지 않는다 */
async function startRefresh(listTestId: string) {
  const list = screen.getByTestId(listTestId);
  await act(async () => {
    list.props.onRefresh();
  });
  expect(screen.getByTestId(listTestId).props.refreshing).toBe(true);
}
const waitRefreshDone = (listTestId: string) =>
  waitFor(() =>
    expect(screen.getByTestId(listTestId).props.refreshing).toBe(false),
  );

describe('새로고침 중에는 탭을 옮기지 않는다 (#177)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('홈: 새로고침 중에는 탭 바를 누르거나 밀어도 그대로이고, 끝나면 새로고침 표시·상단 바가 제자리이며 바로 옮길 수 있다', async () => {
    const app = await renderSignedInHome();
    const read = holdNextRead(app.workRepository, 'getMySchedule');

    await startRefresh('work-home-list');
    await userEvent.press(tab('내 일정'));
    expectSelected('홈');
    await userEvent.press(tab('마이'));
    expectSelected('홈');
    await swipeTab('home', -FAR);
    expectSelected('홈');

    await read.succeed();
    await waitRefreshDone('work-home-list');
    expect(autoHideHeaderOffset()).toBe(0);

    await userEvent.press(tab('내 일정'));
    expectSelected('내 일정');
  });

  it('내 일정: 새로고침 중에는 밀거나 탭 바를 눌러도 그대로이고, 새로고침이 실패해도 끝나면 바로 옮길 수 있다', async () => {
    const app = await renderSignedInHome();
    await userEvent.press(tab('내 일정'));
    await screen.findAllByRole('button', { name: /^\d+월 \d+일 .요일$/ });
    const read = holdNextRead(app.workRepository, 'getPendingWorks');

    await startRefresh('schedule-confirmed-list');
    await swipeTab('schedule', FAR);
    expectSelected('내 일정');
    await swipeTab('schedule', -FAR);
    expectSelected('내 일정');
    await userEvent.press(tab('작업 이력'));
    expectSelected('내 일정');

    await read.fail();
    await waitRefreshDone('schedule-confirmed-list');
    expect(autoHideHeaderOffset()).toBe(0);

    await swipeTab('schedule', FAR);
    expectSelected('홈');
  });

  it('작업 이력: 새로고침 중에는 탭 바를 누르거나 밀어도 그대로이고, 끝나면 바로 옮길 수 있다', async () => {
    const app = await renderSignedInHome();
    await userEvent.press(tab('작업 이력'));
    await screen.findAllByRole('button', { name: /, 완료, / });
    const read = holdNextRead(app.workRepository, 'getWorkHistory');

    await startRefresh('work-history-list');
    await userEvent.press(tab('마이'));
    expectSelected('작업 이력');
    await swipeTab('history', -FAR);
    expectSelected('작업 이력');

    await read.succeed();
    await waitRefreshDone('work-history-list');

    await swipeTab('history', -FAR);
    expectSelected('마이');
  });

  it('Android 뒤로가기도 새로고침 중에는 홈 탭으로 가지 않고, 끝나면 간다', async () => {
    type Handler = Parameters<typeof BackHandler.addEventListener>[1];
    const handlers = new Set<Handler>();
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        handlers.add(handler);
        return { remove: () => handlers.delete(handler) };
      });
    const pressBack = () =>
      act(() => {
        // RN BackHandler 처럼 나중에 등록한 핸들러부터 부르고, 하나가 처리하면 멈춘다
        [...handlers]
          .reverse()
          .some(handler => handler(undefined as never) === true);
      });
    const app = await renderSignedInHome();
    await userEvent.press(tab('작업 이력'));
    await screen.findAllByRole('button', { name: /, 완료, / });
    const read = holdNextRead(app.workRepository, 'getWorkHistory');

    await startRefresh('work-history-list');
    await pressBack();
    expectSelected('작업 이력');

    await read.succeed();
    await waitRefreshDone('work-history-list');
    await pressBack();
    expectSelected('홈');
  });
});
