import { act, screen, userEvent } from '@testing-library/react-native';
import { changeAppState, mockAppState } from '../../jest/appState';
import { createLocalWorkRepository } from '../features/work/data/LocalWorkRepository';
import {
  LOCAL_ORGANIZATION_NAME,
  makeLocalSeed,
} from '../features/work/data/localSeedTesting';
import { renderSignedInApp } from './testing';

// #205 내 작업 홈 히어로 박스는 지금 시각에 진행 중인 작업만 보인다.
// 서버는 시각이 되었다고 알려 주지 않으므로(기사는 실시간 연결을 열 수 없다) 앱이 예정 시작·종료 시각에 맞춰 바꾼다

// 개발 중 프레임 모니터는 앱이 active 면 requestAnimationFrame 을 이어 건다. jest 프리셋의 rAF 는 setTimeout(0) 이라
// setTimeout 을 가짜로 바꾸고 수십 분을 앞당기면 끝없이 돈다. 이 테스트와 관계없어 끈다
jest.mock('../shared/perf/useFrameMonitor', () => ({
  useFrameMonitor: () => {},
}));
// 앱을 켜고 수십 분을 앞당기는 흐름이라 전체 실행(병렬)에서 기본 5초를 넘길 수 있다 (다른 앱 흐름 테스트와 같은 한도)
jest.setTimeout(20_000);

const MINUTE = 60 * 1000;
const NO_CURRENT_WORK = '현재 진행 중인 작업이 없습니다';

// 테스트 시드의 진행할 작업 '보일러 점검'은 시드 시각보다 20분 앞(10분 단위)에 시작해 60분이다.
// 19:20 으로 만들면 2026-11-18(수) 19:00~20:00 이고, 다음 작업전 '세탁기 설치'는 21:00 이다
const workRepository = () =>
  createLocalWorkRepository({
    seed: makeLocalSeed(new Date(2026, 10, 18, 19, 20)),
    organizationName: LOCAL_ORGANIZATION_NAME,
    now: () => new Date(),
  });

const heroCard = () =>
  screen.queryByRole('button', { name: '보일러 점검 상세 보기' });

// Date·setTimeout 만 가짜로 바꾸고 실제 시간만큼 흐르게 한다 (testing.tsx fixAppTestClock 과 같은 목록에서 setTimeout 만 뺐다)
function fakeClockAt(now: Date) {
  jest.useFakeTimers({
    now,
    advanceTimers: true,
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
    ],
  });
}

// 이번 주 일정까지 불러온 홈 (오늘 고른 블록 보기에 19:00 작업 카드가 있다)
async function launchAt(now: Date) {
  mockAppState('active');
  fakeClockAt(now);
  const app = await renderSignedInApp({ workRepository: workRepository() });
  expect(
    await screen.findByRole('button', { name: /^보일러 점검, 작업전/ }),
  ).toBeOnTheScreen();
  return app;
}

const T1900 = new Date(2026, 10, 18, 19, 0).getTime();
const T2000 = new Date(2026, 10, 18, 20, 0).getTime();

// 가짜 시계는 실제 시간(앱을 켜고 기다린 시간)만큼도 흐르므로, 경계까지 남은 시간은 그때의 Date.now() 로 센다
const passUntil = (at: number) =>
  act(() => jest.advanceTimersByTimeAsync(Math.max(0, at - Date.now())));

describe('App — 지금 진행 중인 작업 히어로 (#205)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('18:40 에는 같은 날 19:00 작업이 있어도 메인화면 - 진행(무) 다', async () => {
    await launchAt(new Date(2026, 10, 18, 18, 40));

    expect(screen.getByText(NO_CURRENT_WORK)).toBeOnTheScreen();
    expect(heroCard()).not.toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: '작업 시작' }),
    ).not.toBeOnTheScreen();
  });

  it('화면을 켜 둔 채 19:00 이 되면 새로고침 없이 그 작업 카드("작업 시작")로 바뀐다', async () => {
    await launchAt(new Date(2026, 10, 18, 18, 40));

    await passUntil(T1900 - 1000);
    expect(screen.getByText(NO_CURRENT_WORK)).toBeOnTheScreen();

    await passUntil(T1900);
    expect(heroCard()).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '작업 시작' })).toBeOnTheScreen();
    expect(screen.queryByText(NO_CURRENT_WORK)).not.toBeOnTheScreen();
  });

  it('시작하지 않은 채 예정 종료(20:00)가 지나면 다시 진행(무)로 바뀐다', async () => {
    await launchAt(new Date(2026, 10, 18, 19, 50));
    expect(heroCard()).toBeOnTheScreen();

    await passUntil(T2000 - 1000);
    expect(heroCard()).toBeOnTheScreen();

    // 예정 종료 정각까지는 진행 중이고 그 바로 뒤에 바뀐다
    await passUntil(T2000 + 1);
    expect(screen.getByText(NO_CURRENT_WORK)).toBeOnTheScreen();
    expect(heroCard()).not.toBeOnTheScreen();
  });

  it('시작한 작업은 예정 종료가 지나도 완료 보고 전까지 "작업 수행중" 으로 남는다', async () => {
    await launchAt(new Date(2026, 10, 18, 19, 50));
    await userEvent.press(screen.getByRole('button', { name: '작업 시작' }));
    expect(
      await screen.findByRole('button', { name: '작업 수행중' }),
    ).toBeOnTheScreen();

    await passUntil(T2000 + 10 * MINUTE);

    expect(
      screen.getByRole('button', { name: '작업 수행중' }),
    ).toBeOnTheScreen();
    expect(screen.queryByText(NO_CURRENT_WORK)).not.toBeOnTheScreen();
  });

  it('background 에 있는 동안 19:00 을 지나 돌아오면 바로 진행 중 카드다', async () => {
    await launchAt(new Date(2026, 10, 18, 18, 40));

    await changeAppState('background');
    await passUntil(T1900 + 10 * MINUTE);
    expect(
      screen.getByText(NO_CURRENT_WORK, { includeHiddenElements: true }),
    ).toBeTruthy();
    await changeAppState('active');

    expect(heroCard()).toBeOnTheScreen();
  });

  it('다른 탭에 가 있는 동안 19:00 을 지나 돌아오면 그때 진행 중 카드다', async () => {
    await launchAt(new Date(2026, 10, 18, 18, 40));

    await userEvent.press(screen.getByRole('tab', { name: '내 일정' }));
    await passUntil(T1900 + 10 * MINUTE);
    // 떠나 있는 동안(포커스 없음)은 숨은 홈도 그대로다: 라우트가 포커스를 훅에 넘기는지 지킨다 (PR #207 리뷰)
    expect(
      screen.getByText(NO_CURRENT_WORK, { includeHiddenElements: true }),
    ).toBeTruthy();
    await userEvent.press(screen.getByRole('tab', { name: '홈' }));

    expect(
      await screen.findByRole('button', { name: '보일러 점검 상세 보기' }),
    ).toBeOnTheScreen();
  });
});
