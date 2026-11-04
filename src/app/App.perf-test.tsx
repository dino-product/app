import { useState } from 'react';
import { measureRenders } from 'reassure';
import { saveReportDraft } from '../features/work/reportDraft';
import { perfBudget } from '../shared/perf/budget';
import { createTestApi } from '../shared/testing/renderWithApi';
import { appStorage, writeJson } from '../shared/storage/appStorage';
import App from './App';
import { NAVIGATION_STATE_KEY } from './navigation/persistence';
import { accountServer, signedInSession } from './testing';

// 렌더마다 새 기기(서버·세션·캐시)로 켠다. signedIn 이면 가입을 마친 계정의 세션이 남아 있다
function Launch({ signedIn }: { signedIn: boolean }) {
  const [api] = useState(() =>
    createTestApi({
      server: accountServer(),
      session: signedIn ? signedInSession() : null,
    }),
  );
  return <App api={api} />;
}

// 앞 렌더가 저장한 화면으로 다음 렌더가 복원되지 않게 렌더마다 저장소를 비운다 (#34)
const firstLaunch = () => appStorage.clearAll();

// 작업 상세를 보다 종료된 뒤 다시 연 경우. withDraft 면 완료 보고를 쓰던 중이었다
const relaunchOnWorkDetail = (withDraft: boolean) => () => {
  appStorage.clearAll();
  writeJson(NAVIGATION_STATE_KEY, {
    savedAt: Date.now(),
    state: {
      index: 0,
      routes: [
        {
          name: 'Main',
          state: {
            index: 0,
            routes: [
              {
                name: 'home',
                state: {
                  index: 1,
                  routes: [
                    { name: 'WorkHome' },
                    { name: 'WorkDetail', params: { id: 'work-boiler' } },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  });
  if (!withDraft) {
    return;
  }
  saveReportDraft('work-boiler', {
    beforePhotos: ['mock://before-1'],
    afterPhotos: [],
    memo: '배관 교체',
    parts: '',
    amount: '75000',
    paymentMethod: 'card',
  });
};

// 이어 쓰는 보고는 처음부터 작성 중이라 나갈 때 묻기(#24, usePreventRemove)가 열자마자 켜진다.
// React Navigation 은 이것을 루트·탭·홈 스택의 PreventRemoveProvider 상태로 위로 전해(useInsertionEffect → setState)
// 내비게이터가 그만큼 다시 그려진다. 묻기를 늦게 켜면 열자마자 뒤로 갈 때 묻지 않으므로 예산 예외로 둔다 (#92).
// 허용 횟수는 performance-budget.json 의 render.exceptions 에 있고, 렌더 회귀 게이트도 같은 값을 본다
const RESTORE_WITH_DRAFT =
  '작성하던 완료 보고로 다시 열 때는 나갈 때 묻기를 켜는 갱신만 더해진다';
const restoreWithDraftException = perfBudget.render.exceptions.find(
  item => item.scenario === `App 렌더 예산 ${RESTORE_WITH_DRAFT}`,
);

const expectWithinBudget = (
  result: Awaited<ReturnType<typeof measureRenders>>,
) => {
  expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
    perfBudget.render.maxInitialUpdateCount,
  );
  expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
    perfBudget.render.maxRedundantUpdates,
  );
};

describe('App 렌더 예산', () => {
  it('마운트 시 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    expectWithinBudget(
      await measureRenders(<Launch signedIn />, {
        beforeEach: firstLaunch,
      }),
    );
  });

  // 처음 켜면 로그인 화면부터 연다 (#85)
  it('로그아웃 상태로 마운트해도 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    expectWithinBudget(
      await measureRenders(<Launch signedIn={false} />, {
        beforeEach: firstLaunch,
      }),
    );
  });

  it('종료 후 보던 작업 상세로 다시 열 때도 예산 이내다', async () => {
    expectWithinBudget(
      await measureRenders(<Launch signedIn />, {
        beforeEach: relaunchOnWorkDetail(false),
      }),
    );
  });

  it(RESTORE_WITH_DRAFT, async () => {
    const result = await measureRenders(<Launch signedIn />, {
      beforeEach: relaunchOnWorkDetail(true),
    });

    // 예외 이름이 시나리오 이름(describe + it)과 어긋나면 게이트가 예외를 찾지 못한다
    expect(restoreWithDraftException).toBeDefined();
    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      restoreWithDraftException?.maxInitialUpdateCount ?? 0,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  });
});
