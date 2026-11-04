import { screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ComponentType, ReactNode } from 'react';
import { fixAppTestClock, renderSignedInHome } from './testing';

// 탭 전환 렌더 예산 (#114 리뷰). 탭 첫 화면(내 작업·내 일정·작업 이력)은 포커스를 잃으면 조회 구독을 멈추고(useIsFocused)
// 돌아오면 다시 구독한다. 그때 경로는 다시 그려지지만, 화면에 줄 값(데이터·불러오는 상태·콜백)이 같으면 화면은 다시 그리지 않는다.
// 목표: 떠나는 탭의 화면 0, 데이터가 바뀌지 않은 채 돌아온 탭의 화면 0. 화면 컴포넌트가 실제로 그려진 횟수를 센다
const mockRenders = { home: 0, schedule: 0, history: 0 };

// memo 로 감싼 화면의 안쪽 함수를 같은 memo 로 감싸 실제로 그려질 때만 센다
function mockCounted<P extends object>(
  screenModule: Record<string, unknown>,
  name: string,
  key: keyof typeof mockRenders,
) {
  const { memo } = jest.requireActual<typeof import('react')>('react');
  const inner = (screenModule[name] as { type: (props: P) => ReactNode }).type;
  return {
    ...screenModule,
    [name]: memo((props: P) => {
      mockRenders[key] += 1;
      return inner(props);
    }) as unknown as ComponentType<P>,
  };
}

jest.mock('../features/work/screens/WorkHomeScreen', () =>
  mockCounted(
    jest.requireActual('../features/work/screens/WorkHomeScreen'),
    'WorkHomeScreen',
    'home',
  ),
);
jest.mock('../features/schedule/screens/ScheduleScreen', () =>
  mockCounted(
    jest.requireActual('../features/schedule/screens/ScheduleScreen'),
    'ScheduleScreen',
    'schedule',
  ),
);
jest.mock('../features/history/screens/WorkHistoryScreen', () =>
  mockCounted(
    jest.requireActual('../features/history/screens/WorkHistoryScreen'),
    'WorkHistoryScreen',
    'history',
  ),
);

fixAppTestClock();

describe('탭 전환 렌더 예산', () => {
  it('탭을 오가도 떠나는 탭과 데이터가 그대로인 채 돌아온 탭의 화면은 다시 그려지지 않는다', async () => {
    const app = await renderSignedInHome();
    const tab = (name: string) => screen.getByRole('tab', { name });
    // 다시 받는 조회가 끝날 때까지 (돌아온 탭은 오래된 조회를 새로 받는다. 같은 값이면 화면에 주는 값도 같다)
    const settle = () =>
      waitFor(() => expect(app.queryClient.isFetching()).toBe(0));
    // 세 탭을 한 번씩 열어 데이터를 받아 둔다
    await userEvent.press(tab('내 일정'));
    await screen.findAllByRole('button', { name: /^\d+월 \d+일 .요일$/ });
    await userEvent.press(tab('작업 이력'));
    await screen.findAllByRole('button', { name: /, 완료, / });
    await settle();
    const before = { ...mockRenders };

    for (const name of ['홈', '내 일정', '작업 이력', '홈', '내 일정']) {
      await userEvent.press(tab(name));
      await settle();
    }

    expect({
      home: mockRenders.home - before.home,
      schedule: mockRenders.schedule - before.schedule,
      history: mockRenders.history - before.history,
    }).toEqual({ home: 0, schedule: 0, history: 0 });
  });
});
