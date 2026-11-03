import { measureRenders } from 'reassure';
import { saveReportDraft } from '../features/work/reportDraft';
import { perfBudget } from '../shared/perf/budget';
import { appStorage, writeJson } from '../shared/storage/appStorage';
import App from './App';
import { NAVIGATION_STATE_KEY } from './navigation/persistence';

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
// 내비게이터가 그만큼 다시 그려진다. 사용자가 처음 입력할 때 생기는 것과 같은 갱신이고, 초안을 가진 채 다시 열 때 한 번만 생긴다.
// 묻기를 늦게 켜면 열자마자 뒤로 갈 때 묻지 않으므로 받아들이고, 이보다 늘지 않는지만 본다
const PREVENT_REMOVE_REGISTRATION_UPDATES = 4;

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
      await measureRenders(<App />, { beforeEach: firstLaunch }),
    );
  });

  it('종료 후 보던 작업 상세로 다시 열 때도 예산 이내다', async () => {
    expectWithinBudget(
      await measureRenders(<App />, {
        beforeEach: relaunchOnWorkDetail(false),
      }),
    );
  });

  it('작성하던 완료 보고로 다시 열 때는 나갈 때 묻기를 켜는 갱신만 더해진다', async () => {
    const result = await measureRenders(<App />, {
      beforeEach: relaunchOnWorkDetail(true),
    });

    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      PREVENT_REMOVE_REGISTRATION_UPDATES,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  });
});
