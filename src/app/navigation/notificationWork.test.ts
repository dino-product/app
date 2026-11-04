import { QueryClient } from '@tanstack/react-query';
import { workKeys } from '../../features/work/data/keys';
import type { WorkRepository } from '../../features/work/data/types';
import { notificationWorkScreen } from './notificationWork';

// 알림(알림센터 #117·푸시 #118)으로 여는 작업의 화면. 알림에는 작업 상태가 없어 상세를 먼저 받는다

// 기본 재시도(3번)가 켜진 캐시. 미리 받기가 이것을 끄는지 본다
const queryClientWithRetry = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: 3, retryDelay: 0, gcTime: Infinity } },
  });

const repositoryReturning = (getWorkDetail: jest.Mock): WorkRepository =>
  ({ getWorkDetail } as unknown as WorkRepository);

it('수락 대기(배정됨) 작업이면 수락·거절하는 요청 상세', async () => {
  const getWorkDetail = jest
    .fn()
    .mockResolvedValue({ workStatus: 'PENDING_ACCEPT' });

  await expect(
    notificationWorkScreen(
      queryClientWithRetry(),
      repositoryReturning(getWorkDetail),
      10,
      7,
    ),
  ).resolves.toBe('request');
  expect(getWorkDetail).toHaveBeenCalledWith(
    10,
    expect.objectContaining({ organizationId: 7 }),
  );
});

it.each(['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'])(
  '%s 작업이면 작업 상세',
  async workStatus => {
    await expect(
      notificationWorkScreen(
        queryClientWithRetry(),
        repositoryReturning(jest.fn().mockResolvedValue({ workStatus })),
        10,
      ),
    ).resolves.toBe('detail');
  },
);

it('받은 상세는 같은 캐시 키에 남아 연 화면이 바로 그린다', async () => {
  const queryClient = queryClientWithRetry();
  const work = { workStatus: 'ACCEPTED' };

  await notificationWorkScreen(
    queryClient,
    repositoryReturning(jest.fn().mockResolvedValue(work)),
    10,
    7,
  );

  expect(queryClient.getQueryData(workKeys.detail(10, 7))).toBe(work);
});

it('받지 못하면 다시 시도하지 않고 작업 상세(그 상태와 다시 시도를 보인다)', async () => {
  const getWorkDetail = jest.fn().mockRejectedValue(new Error('SCHEDULE-001'));

  await expect(
    notificationWorkScreen(
      queryClientWithRetry(),
      repositoryReturning(getWorkDetail),
      10,
    ),
  ).resolves.toBe('detail');
  expect(getWorkDetail).toHaveBeenCalledTimes(1);
});
