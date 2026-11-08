import {
  fireEvent,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import {
  pickOnePhotoFromLibrary,
  resetPhotoLibrary,
} from '../../jest/photoPicker';
import { createLocalWorkRepository } from '../features/work/data/LocalWorkRepository';
import {
  LOCAL_ORGANIZATION_NAME,
  makeLocalSeed,
} from '../features/work/data/localSeedTesting';
import { ApiError, ApiErrorMessage } from '../shared/api';
import {
  APP_TEST_NOW,
  findHomeLoaded,
  findWorkDetailLoaded,
  fixAppTestClock,
  openStartedWorkDetail,
  renderSignedInApp,
  startCurrentWork,
} from './testing';

// #114 화면이 작업 저장소를 React Query 훅으로 쓰는 흐름: 불러오기 실패·다시 시도, 당겨서 새로고침,
// 변경 실패 시 화면 상태 유지와 코드별 문구. 저장소는 로컬 저장소에 실패를 끼운 가짜를 주입한다
fixAppTestClock();

const networkError = () =>
  new ApiError({ kind: 'network', message: ApiErrorMessage.network });
const scheduleError = (status: number, code: string) =>
  new ApiError({ kind: 'http', status, code, message: '서버 문구' });

function setup() {
  const repository = createLocalWorkRepository({
    seed: makeLocalSeed(new Date(APP_TEST_NOW)),
    organizationName: LOCAL_ORGANIZATION_NAME,
    now: () => new Date(),
  });
  const render = () => renderSignedInApp({ workRepository: repository });
  return { repository, render };
}

const spyAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});
const tab = (name: string) => screen.getByRole('tab', { name });

describe('App — 작업 데이터 (#114)', () => {
  // 사진 추가 칸은 시스템 선택지에서 앨범의 사진 한 장을 고른 것으로 한다 (#111)
  beforeEach(pickOnePhotoFromLibrary);

  afterEach(() => {
    jest.restoreAllMocks();
    resetPhotoLibrary();
  });

  describe('내 작업 홈', () => {
    it('불러오지 못하면 문구와 다시 시도를 보이고, 다시 시도하면 불러온다', async () => {
      const { repository, render } = setup();
      jest
        .spyOn(repository, 'getMySchedule')
        .mockRejectedValueOnce(networkError());
      await render();

      expect(
        await screen.findByText(ApiErrorMessage.network),
      ).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('button', { name: '다시 시도' }));

      expect(await findHomeLoaded()).toBeOnTheScreen();
    });

    it('당겨서 새로고침하면 다시 불러온다', async () => {
      const { repository, render } = setup();
      const read = jest.spyOn(repository, 'getMySchedule');
      await render();
      await findHomeLoaded();
      read.mockClear();

      await fireEvent(screen.getByTestId('work-home-list'), 'refresh');

      await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    });
  });

  describe('내 일정', () => {
    async function openPending(render: () => Promise<unknown>) {
      await render();
      await userEvent.press(tab('내 일정'));
      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
      return screen.findAllByRole('button', { name: /수락$/ });
    }

    it('수락이 실패하면 요청을 목록에 두고 문구로 알린다 (다시 누를 수 있다)', async () => {
      const alert = spyAlert();
      const { repository, render } = setup();
      jest.spyOn(repository, 'acceptWork').mockRejectedValue(networkError());
      const before = (await openPending(render)).length;

      await userEvent.press(
        screen.getAllByRole('button', { name: /수락$/ })[0],
      );

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '수락하지 못했어요',
          ApiErrorMessage.network,
        ),
      );
      const buttons = screen.getAllByRole('button', { name: /수락$/ });
      expect(buttons).toHaveLength(before);
      expect(buttons[0]).toBeEnabled();
    });

    it('수락이 성공하면 응답 필요에서 빠진다', async () => {
      const { render } = setup();
      const before = (await openPending(render)).length;

      await userEvent.press(
        screen.getAllByRole('button', { name: /수락$/ })[0],
      );

      await waitFor(() =>
        expect(screen.queryAllByRole('button', { name: /수락$/ })).toHaveLength(
          before - 1,
        ),
      );
    });

    it('당겨서 새로고침하면 응답 필요를 다시 불러온다', async () => {
      const { repository, render } = setup();
      const read = jest.spyOn(repository, 'getPendingWorks');
      await openPending(render);
      read.mockClear();

      await fireEvent(screen.getByTestId('schedule-pending-list'), 'refresh');

      await waitFor(() => expect(read).toHaveBeenCalled());
    });

    it('거절이 실패하면 거절 사유에 머물러 다시 낼 수 있다', async () => {
      const alert = spyAlert();
      const { repository, render } = setup();
      jest
        .spyOn(repository, 'rejectWork')
        .mockRejectedValue(scheduleError(409, 'SCHEDULE-002'));
      await openPending(render);

      await userEvent.press(
        screen.getAllByRole('button', { name: /거절$/ })[0],
      );
      await userEvent.press(
        screen.getByRole('radio', { name: '일정이 맞지 않습니다' }),
      );
      await userEvent.press(screen.getByRole('button', { name: '거절 제출' }));

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '거절하지 못했어요',
          '이미 처리됐거나 바뀐 요청이라 거절하지 못했어요. 최신 정보를 다시 불러왔으니 확인해 주세요.',
        ),
      );
      expect(
        screen.getByRole('header', { name: '거절 사유' }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole('radio', { name: '일정이 맞지 않습니다' }),
      ).toBeChecked();
      expect(screen.getByRole('button', { name: '거절 제출' })).toBeEnabled();
    });

    it('거절 사유를 서버 사유 코드로 보낸다 (기타는 메모와 함께)', async () => {
      const { repository, render } = setup();
      const reject = jest.spyOn(repository, 'rejectWork');
      await openPending(render);

      await userEvent.press(
        screen.getAllByRole('button', { name: /거절$/ })[0],
      );
      await userEvent.press(
        screen.getByRole('radio', { name: '기타 (직접 입력)' }),
      );
      await userEvent.type(
        screen.getByLabelText('기타 거절 사유 입력'),
        ' 차량 고장 ',
      );
      await userEvent.press(screen.getByRole('button', { name: '거절 제출' }));

      expect(
        await screen.findByRole('header', { name: '내 일정' }),
      ).toBeOnTheScreen();
      // 응답 필요 첫 요청은 내일의 도어록 교체(106)다
      expect(reject).toHaveBeenCalledWith({
        workId: 106,
        assignmentNumber: 1,
        reason: 'OTHER',
        note: '차량 고장',
      });
    });
  });

  describe('작업 상세', () => {
    it('완료 보고 제출이 작업중이 아니라고 거부되면(-002) 그 상황 문구로 알린다', async () => {
      const alert = spyAlert();
      const { repository, render } = setup();
      jest
        .spyOn(repository, 'submitCompletionReport')
        .mockRejectedValue(scheduleError(409, 'SCHEDULE-002'));
      await render();
      await openStartedWorkDetail();
      await userEvent.press(
        screen.getByRole('button', { name: '작업 전 사진 추가' }),
      );
      await userEvent.press(
        screen.getByRole('button', { name: '작업 후 사진 추가' }),
      );

      await userEvent.press(
        screen.getByRole('button', { name: '완료보고 제출' }),
      );

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '완료 보고를 제출하지 못했어요',
          '작업중인 작업만 완료 보고를 낼 수 있어요. 최신 정보를 다시 불러왔으니 확인해 주세요.',
        ),
      );
      expect(
        screen.queryByRole('header', { name: '제출 완료' }),
      ).not.toBeOnTheScreen();
    });

    it('지금 배정 순번이 없는 작업이면 명령을 보내지 않고 볼 수 없는 작업으로 알리며 상세를 다시 받는다', async () => {
      const alert = spyAlert();
      const { repository, render } = setup();
      const getWorkDetail = repository.getWorkDetail.bind(repository);
      const read = jest
        .spyOn(repository, 'getWorkDetail')
        .mockImplementation(async (workId, options) => ({
          ...(await getWorkDetail(workId, options)),
          assignmentNumber: null,
        }));
      const start = jest.spyOn(repository, 'startWork');
      await render();
      await userEvent.press(await findHomeLoaded());
      read.mockClear();

      await userEvent.press(
        await screen.findByRole('button', { name: '작업 시작' }),
      );

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '작업을 시작하지 못했어요',
          '볼 수 없는 작업이에요.',
        ),
      );
      expect(start).not.toHaveBeenCalled();
      await waitFor(() => expect(read).toHaveBeenCalled());
    });

    it('완료 보고 제출이 배정이 바뀌어 실패하면(-010) 입력을 두고 알리며 상세를 다시 불러온다', async () => {
      const alert = spyAlert();
      const { repository, render } = setup();
      jest
        .spyOn(repository, 'submitCompletionReport')
        .mockRejectedValue(scheduleError(409, 'SCHEDULE-010'));
      const read = jest.spyOn(repository, 'getWorkDetail');
      await render();
      await openStartedWorkDetail();
      await userEvent.press(
        screen.getByRole('button', { name: '작업 전 사진 추가' }),
      );
      await userEvent.press(
        screen.getByRole('button', { name: '작업 후 사진 추가' }),
      );
      read.mockClear();

      await userEvent.press(
        screen.getByRole('button', { name: '완료보고 제출' }),
      );

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '완료 보고를 제출하지 못했어요',
          '배정이 바뀌었어요. 최신 정보를 다시 불러왔으니 확인해 주세요.',
        ),
      );
      await waitFor(() => expect(read).toHaveBeenCalled());
      expect(
        screen.queryByRole('header', { name: '제출 완료' }),
      ).not.toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: '작업 후 사진 추가' }),
      ).toHaveAccessibilityValue({ text: '1/6' });
      expect(
        screen.getByRole('button', { name: '완료보고 제출' }),
      ).toBeEnabled();
    });

    it('작업 상세를 불러오지 못하면 다시 시도할 수 있다', async () => {
      const { repository, render } = setup();
      jest
        .spyOn(repository, 'getWorkDetail')
        .mockRejectedValueOnce(networkError());
      await render();
      await startCurrentWork();
      await userEvent.press(await findHomeLoaded());

      expect(
        await screen.findByText(ApiErrorMessage.network),
      ).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('button', { name: '다시 시도' }));

      expect(await findWorkDetailLoaded()).toBeOnTheScreen();
    });

    it('완료 보고는 사진·메모·부품·계획 금액·결제 방식으로 제출 Command 를 보낸다', async () => {
      const { repository, render } = setup();
      const submit = jest.spyOn(repository, 'submitCompletionReport');
      await render();
      await userEvent.press(
        await screen.findByRole('button', { name: '작업 시작' }),
      );
      await userEvent.press(
        await screen.findByRole('button', { name: '작업 수행중' }),
      );
      await findWorkDetailLoaded();
      await userEvent.press(
        screen.getByRole('button', { name: '작업 전 사진 추가' }),
      );
      await userEvent.press(
        screen.getByRole('button', { name: '작업 후 사진 추가' }),
      );
      await userEvent.type(screen.getByLabelText('수행 메모 입력'), '교체');
      await userEvent.press(
        screen.getByRole('button', { name: '완료보고 제출' }),
      );

      expect(
        await screen.findByRole('header', { name: '제출 완료' }),
      ).toBeOnTheScreen();
      expect(submit).toHaveBeenCalledWith({
        workId: 101,
        assignmentNumber: 1,
        beforePhotos: ['file:///tmp/photo-1.jpg'],
        afterPhotos: ['file:///tmp/photo-2.jpg'],
        usedParts: null,
        workNote: '교체',
        actualFee: 75000,
        actualPaymentMethod: 'CREDIT_CARD',
      });
    });
  });

  // 포커스를 잃은 탭 화면은 조회 구독을 멈춘다 (#110 관례)
  describe('숨은 탭', () => {
    it('다른 탭에서 수락해도 숨은 홈은 다시 받지 않고, 홈으로 돌아오면 받는다', async () => {
      const { repository, render } = setup();
      const read = jest.spyOn(repository, 'getMySchedule');
      await render();
      await findHomeLoaded();
      const homeWeek = read.mock.calls[0][0];
      const homeReads = () =>
        read.mock.calls.filter(([period]) => period.from === homeWeek.from)
          .length;
      await userEvent.press(tab('내 일정'));
      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
      const requests = (await screen.findAllByRole('button', { name: /수락$/ }))
        .length;
      const before = homeReads();

      await userEvent.press(
        screen.getAllByRole('button', { name: /수락$/ })[0],
      );
      // 수락이 끝나고 보이는 목록은 새로 받았다
      await waitFor(() =>
        expect(screen.queryAllByRole('button', { name: /수락$/ })).toHaveLength(
          requests - 1,
        ),
      );
      expect(homeReads()).toBe(before);

      await userEvent.press(tab('홈'));
      await waitFor(() => expect(homeReads()).toBe(before + 1));
    });
  });

  describe('작업 이력', () => {
    it('불러오지 못하면 다시 시도하고, 당겨서 새로고침하면 다시 불러온다', async () => {
      const { repository, render } = setup();
      const read = jest
        .spyOn(repository, 'getWorkHistory')
        .mockRejectedValueOnce(networkError());
      await render();
      await findHomeLoaded();
      await userEvent.press(tab('작업 이력'));

      await userEvent.press(
        await screen.findByRole('button', { name: '다시 시도' }),
      );
      expect(
        (await screen.findAllByRole('button', { name: /, 완료, / })).length,
      ).toBeGreaterThan(0);

      read.mockClear();
      await fireEvent(screen.getByTestId('work-history-list'), 'refresh');
      await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    });

    it('다른 달로 가면 그 달을 불러오고, 누적 완료는 전체 완료 수다', async () => {
      const { repository, render } = setup();
      const read = jest.spyOn(repository, 'getWorkHistory');
      await render();
      await findHomeLoaded();
      await userEvent.press(tab('작업 이력'));
      await screen.findAllByRole('button', { name: /, 완료, / });

      await userEvent.press(screen.getByRole('button', { name: '이전 달' }));

      await waitFor(() =>
        expect(read).toHaveBeenLastCalledWith(
          {
            from: new Date(2026, 8, 1).toISOString(),
            to: new Date(2026, 9, 1).toISOString(),
          },
          expect.anything(),
        ),
      );
      // 처음 데이터의 완료 작업은 13건이다
      expect(screen.getByLabelText('누적 완료 13건')).toBeOnTheScreen();
    });
  });
});
