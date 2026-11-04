import { useState } from 'react';
import { measureRenders } from 'reassure';
import { saveSignedInStep } from '../features/onboarding/login';
import { createLocalWorkRepository } from '../features/work/data/LocalWorkRepository';
import { makeLocalSeed } from '../features/work/data/localSeed';
import {
  myScheduleQuery,
  workDetailQuery,
} from '../features/work/data/queries';
import type { WorkRepository } from '../features/work/data/types';
import { weekPeriod } from '../features/work/data/views';
import { saveReportDraft } from '../features/work/reportDraft';
import { perfBudget } from '../shared/perf/budget';
import { createTestApi } from '../shared/testing/renderWithApi';
import { appStorage, writeJson } from '../shared/storage/appStorage';
import App from './App';
import { NAVIGATION_STATE_KEY } from './navigation/persistence';
import {
  accountServer,
  APP_TEST_NOW,
  fixAppTestClock,
  signedInSession,
} from './testing';

// 렌더마다 새 기기(서버·세션·캐시)로 켠다. signedIn 이면 가입을 마친 계정의 세션이 Keychain 에 남아 있다.
// 켤 때는 MMKV 의 가입 단계 표식으로 바로 그리고 세션 확인은 뒤에서 한다(#113). 단계가 같으면 다시 그리지 않는다.
// 작업·일정은 작업 저장소에서 비동기로 불러온다. 렌더 예산은 불러온 뒤의 화면을 재므로 캐시에 미리 넣은 데이터로 그린다 (#114).
// 재는 범위: 캐시가 있는 화면의 마운트(staleTime: Infinity 라 그리자마자 다시 받지 않는다). 불러오는 동안의 로딩 → 데이터 전환과
// 다시 받는 렌더는 재지 않는다. 지금은 고정한다 (로컬 처음 데이터가 지금 기준이다)
fixAppTestClock();

/** 로컬 처음 데이터의 오늘 진행할 작업 (보일러 점검) */
const CURRENT_WORK_ID = 101;

type Device = {
  api: ReturnType<typeof createTestApi>;
  workRepository: WorkRepository;
};
let device: Device;

// 새 기기를 만들고 홈·작업 상세가 처음 그릴 값을 캐시에 넣는다
async function prepareDevice(signedIn: boolean) {
  const now = new Date(APP_TEST_NOW);
  const workRepository = createLocalWorkRepository({
    seed: makeLocalSeed(now),
    now: () => now,
  });
  // 진행할 작업을 시작해 둔다: 작업 상세는 작업중일 때 완료 보고 영역을 그린다 (이어 쓰는 보고로 다시 여는 경우를 잰다)
  await workRepository.startWork({
    workId: CURRENT_WORK_ID,
    assignmentNumber: 1,
  });
  const api = createTestApi({
    server: accountServer(),
    session: signedIn ? signedInSession() : null,
  });
  api.queryClient.setDefaultOptions({
    queries: {
      ...api.queryClient.getDefaultOptions().queries,
      staleTime: Infinity,
    },
  });
  await api.queryClient.prefetchQuery(
    myScheduleQuery(workRepository, weekPeriod(now)),
  );
  await api.queryClient.prefetchQuery(
    workDetailQuery(workRepository, CURRENT_WORK_ID),
  );
  device = { api, workRepository };
}

function Launch() {
  const [{ api, workRepository }] = useState(() => device);
  return <App api={{ ...api, workRepository }} />;
}

// 앞 렌더가 저장한 화면으로 다음 렌더가 복원되지 않게 렌더마다 저장소를 비운다 (#34)
const firstLaunch = () => {
  appStorage.clearAll();
  return prepareDevice(false);
};
// 가입을 마친 계정으로 로그인해 둔 기기
const signedInLaunch = () => {
  appStorage.clearAll();
  saveSignedInStep('COMPLETED');
  return prepareDevice(true);
};

// 작업 상세를 보다 종료된 뒤 다시 연 경우. withDraft 면 완료 보고를 쓰던 중이었다
const relaunchOnWorkDetail = (withDraft: boolean) => async () => {
  await signedInLaunch();
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
                    {
                      name: 'WorkDetail',
                      params: { id: String(CURRENT_WORK_ID) },
                    },
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
  saveReportDraft(String(CURRENT_WORK_ID), {
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
      await measureRenders(<Launch />, { beforeEach: signedInLaunch }),
    );
  });

  // 처음 켜면 로그인 화면부터 연다 (#85)
  it('로그아웃 상태로 마운트해도 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    expectWithinBudget(
      await measureRenders(<Launch />, { beforeEach: firstLaunch }),
    );
  });

  it('종료 후 보던 작업 상세로 다시 열 때도 예산 이내다', async () => {
    expectWithinBudget(
      await measureRenders(<Launch />, {
        beforeEach: relaunchOnWorkDetail(false),
      }),
    );
  });

  it(RESTORE_WITH_DRAFT, async () => {
    const result = await measureRenders(<Launch />, {
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
