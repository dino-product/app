import {
  act,
  fireEvent,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import {
  AccessibilityInfo,
  Alert,
  Dimensions,
  NativeModules,
} from 'react-native';
import { mockAppState } from '../../jest/appState';
import { scanQr } from '../../jest/qrCamera';
import { escapeFrom } from '../../jest/voiceOver';
import {
  cancelRequestPath,
  COMPANY_LOOKUP_PATH,
  OrganizationErrorCode,
  PARTICIPATION_REQUESTS_PATH,
} from '../features/my/org/participationApi';
import { membershipsQueryKey } from '../features/my/memberships';
import { participationRequestsKey } from '../features/my/org/participationQueries';
import {
  EXISTING_REQUESTS,
  participationOf,
  REJECT_REASON,
} from '../features/my/org/testing';
import { fail, networkError, ok } from '../shared/testing/fakeServer';
import { fixAppTestClock, renderSignedInApp } from './testing';

// 마이 › 조직 참여 (#73). "지금 보이는 화면" 은 헤더가 접근성 트리에 있는지로 확인한다 (App.test 와 같은 방식)
const header = (name: string) => screen.queryByRole('header', { name });
const tab = (name: string) => screen.getByRole('tab', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });

// 바텀시트 애니메이션(프리셋의 네이티브 애니메이션 목)은 테스트가 끝낸다
let runningAnimations: Array<(result: { finished: boolean }) => void> = [];
const finishAnimations = () =>
  act(() => {
    runningAnimations.splice(0).forEach(end => end({ finished: true }));
  });

// 회사 참여는 가짜 서버가 답한다 (features/my/org/testing): 신청 현황에 거절 1(요청 3)·승인 대기 2(한빛 설비 1, 그린 테크 2)
async function openMyPage() {
  const app = await renderSignedInApp();
  await userEvent.press(tab('마이'));
  // 신청 현황 배지는 서버 목록을 받은 뒤 보인다
  await screen.findByRole('button', { name: '신청 현황, 2건' });
  return app;
}

async function findCompany(code: string) {
  await userEvent.type(screen.getByLabelText('회사 코드 입력'), code);
  await userEvent.press(button('회사 확인'));
}

fixAppTestClock();

describe('App — 조직 참여', () => {
  beforeEach(() => {
    runningAnimations = [];
    jest
      .spyOn(NativeModules.NativeAnimatedModule, 'startAnimatingNode')
      .mockImplementation((...args: unknown[]) => {
        runningAnimations.push(
          args[3] as (result: { finished: boolean }) => void,
        );
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('마이페이지의 신청 현황 배지는 승인 대기 건수와 같다', async () => {
    await openMyPage();

    await userEvent.press(button('신청 현황, 2건'));

    expect(header('참여 신청 현황')).toBeOnTheScreen();
    expect(header('승인 대기 2')).toBeOnTheScreen();
    expect(tab('마이')).toBeSelected();
  });

  it('마이페이지의 조직 참여와 신청 현황의 조직 참여하기로 회사 찾기가 열린다', async () => {
    await openMyPage();

    await userEvent.press(button('조직 참여'));
    expect(header('회사 찾기')).toBeOnTheScreen();
    await userEvent.press(button('뒤로 가기'));

    await userEvent.press(button('신청 현황, 2건'));
    await userEvent.press(button('조직 참여하기'));
    expect(header('회사 찾기')).toBeOnTheScreen();
  });

  it('코드로 회사를 찾아 기사로 요청하면 요청 완료가 보이고, 확인하면 마이페이지에 배지가 하나 늘어 있다', async () => {
    await openMyPage();
    await userEvent.press(button('조직 참여'));

    await findCompany('RBT124');
    expect(
      await screen.findByRole('header', { name: '역할을 선택해주세요' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Orbit')).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('radio', { name: /^기사/ }));
    await userEvent.press(button('참여 요청하기'));

    expect(header('참여 요청을 보냈어요')).toBeOnTheScreen();
    expect(screen.getByLabelText('회사, Orbit')).toBeOnTheScreen();
    expect(screen.getByLabelText('희망 유형, 기사')).toBeOnTheScreen();
    expect(screen.getByLabelText('요청 경로, 회사 코드')).toBeOnTheScreen();

    await userEvent.press(button('확인'));
    expect(header('마이페이지')).toBeOnTheScreen();
    expect(button('신청 현황, 3건')).toBeOnTheScreen();
  });

  // 요청을 다시 보내지 않게 회사 찾기·역할 선택은 스택에서 뺀다
  it('요청 완료에서 뒤로 가면 회사 찾기가 아니라 처음 연 화면으로 돌아간다', async () => {
    await openMyPage();
    await userEvent.press(button('조직 참여'));
    await findCompany('RBT124');
    await userEvent.press(await screen.findByRole('radio', { name: /^직원/ }));
    await userEvent.press(button('참여 요청하기'));

    await userEvent.press(button('뒤로 가기'));

    expect(header('마이페이지')).toBeOnTheScreen();
    expect(header('회사 찾기')).toBeNull();
  });

  it('요청 완료에서 신청 취소를 확정하면 마이페이지로 돌아가고 배지는 그대로다', async () => {
    await openMyPage();
    await userEvent.press(button('조직 참여'));
    await findCompany('RBT124');
    await userEvent.press(await screen.findByRole('radio', { name: /^기사/ }));
    await userEvent.press(button('참여 요청하기'));

    await userEvent.press(button('신청 취소'));
    expect(header('Orbit 참여 신청을 취소할까요?')).toBeOnTheScreen();
    await userEvent.press(button('취소'));
    await finishAnimations();

    expect(header('마이페이지')).toBeOnTheScreen();
    expect(button('신청 현황, 2건')).toBeOnTheScreen();
  });

  it('이미 소속된 회사 코드면 모달을 띄우고, 확인하면 입력이 남는다', async () => {
    await openMyPage();
    await userEvent.press(button('조직 참여'));

    await findCompany('BS0001');

    expect(
      await screen.findByRole('header', { name: '이미 참여 중인 회사예요' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '오빗 서비스에 이미 소속되어 있어\n참여 요청을 다시 보낼 수 없습니다.',
      ),
    ).toBeOnTheScreen();
    await userEvent.press(button('확인'));
    expect(header('이미 참여 중인 회사예요')).toBeNull();
    expect(screen.getByLabelText('회사 코드 입력')).toHaveDisplayValue(
      'BS0001',
    );
  });

  it('유효하지 않은 코드면 제목이 회사 참여로 바뀐다', async () => {
    await openMyPage();
    await userEvent.press(button('조직 참여'));

    await findCompany('ZZZZZZ');

    expect(
      await screen.findByRole('header', { name: '회사 참여' }),
    ).toBeOnTheScreen();
    expect(header('유효하지 않은 회사 코드입니다')).toBeOnTheScreen();
  });

  it('신청 현황에서 취소하면 목록에서 빠지고, 마지막 건이면 빈 상태가 된다', async () => {
    await openMyPage();
    await userEvent.press(button('신청 현황, 2건'));

    for (const name of ['한빛 설비', '그린 테크']) {
      await userEvent.press(button(`${name} 신청 취소`));
      await userEvent.press(button('취소'));
      await finishAnimations();
    }

    expect(screen.getByText('참여 신청 내역이 없어요')).toBeOnTheScreen();
    await userEvent.press(button('뒤로 가기'));
    expect(button('신청 현황')).toBeOnTheScreen();
  });

  it('알림센터의 참여 거절 알림을 누르면 거절 사유가 보이고, 확인하면 알림센터로 돌아온다', async () => {
    await openMyPage();
    await userEvent.press(button('알림센터'));

    await userEvent.press(
      await screen.findByRole('button', { name: /참여 요청이 거절되었습니다/ }),
    );

    expect(
      await screen.findByRole('header', { name: '참여 요청이 거절되었어요' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('현재 기사 인원이 충분해 요청을 받지 않고 있어요.'),
    ).toBeOnTheScreen();
    await userEvent.press(button('확인'));
    expect(header('알림센터')).toBeOnTheScreen();
  });

  // 카메라는 jest/qrCamera 의 목이다. 테스트에는 iOS 카메라 권한 앱 모듈이 없어 카메라가 열릴 때 시스템에 맡긴다(허용으로 본다)
  describe('QR 코드 인식 (#108)', () => {
    const JOIN_LINK = 'https://orbit.example/join/RBT124';
    const camera = () =>
      screen.queryByTestId('qr-camera', { includeHiddenElements: true });

    async function openQrScan() {
      mockAppState('active');
      const app = await openMyPage();
      await userEvent.press(button('조직 참여'));
      await userEvent.press(button('QR 코드 인식'));
      return app;
    }

    it('회사 찾기의 QR 코드 인식은 하단 탭 없이 전체 화면 카메라를 열고, 닫으면 회사 찾기로 돌아온다', async () => {
      await openQrScan();

      expect(
        await screen.findByRole('header', { name: 'QR 코드 인식' }),
      ).toBeOnTheScreen();
      expect(camera()).toHaveProp('isActive', true);
      expect(screen.queryByRole('tab', { name: '마이' })).not.toBeOnTheScreen();

      await userEvent.press(button('닫기'));

      expect(header('회사 찾기')).toBeOnTheScreen();
      expect(camera()).toBeNull();
    });

    it('QR 로 회사를 찾아 기사로 요청하면 요청 경로가 QR 코드다', async () => {
      const app = await openQrScan();
      await screen.findByRole('header', { name: 'QR 코드 인식' });

      await scanQr(JOIN_LINK);
      expect(
        await screen.findByRole('header', { name: '역할을 선택해주세요' }),
      ).toBeOnTheScreen();
      expect(screen.getByText('Orbit')).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('radio', { name: /^기사/ }));
      await userEvent.press(button('참여 요청하기'));

      expect(header('참여 요청을 보냈어요')).toBeOnTheScreen();
      expect(screen.getByLabelText('요청 경로, QR 코드')).toBeOnTheScreen();
      expect(
        app.server.callsTo('POST', PARTICIPATION_REQUESTS_PATH)[0].body,
      ).toEqual({
        companyCode: 'RBT124',
        desiredType: 'TECHNICIAN',
        requestChannel: 'QR_CODE',
      });
    });

    // 카메라는 회사를 찾으면 스택에서 빠진다. 다시 돌아와 같은 QR 로 또 확인하지 않는다
    it('QR 로 찾은 회사의 역할 선택에서 뒤로 가면 카메라가 아니라 회사 찾기로 간다', async () => {
      await openQrScan();
      await screen.findByRole('header', { name: 'QR 코드 인식' });
      await scanQr(JOIN_LINK);
      await screen.findByRole('header', { name: '역할을 선택해주세요' });

      await userEvent.press(button('뒤로 가기'));

      expect(header('회사 찾기')).toBeOnTheScreen();
      expect(camera()).toBeNull();
      expect(tab('마이')).toBeSelected();
    });

    it('폐기된 이전 코드의 QR 이면 유효하지 않은 코드 안내를 띄우고 카메라에 머문다', async () => {
      await openQrScan();
      await screen.findByRole('header', { name: 'QR 코드 인식' });

      await scanQr('https://orbit.example/join/PRV014');

      expect(
        await screen.findByRole('header', {
          name: '유효하지 않은 회사 코드입니다',
        }),
      ).toBeOnTheScreen();
      await userEvent.press(button('확인'));
      expect(header('QR 코드 인식')).toBeOnTheScreen();
    });
  });

  describe('서버 연동 (#116)', () => {
    it('회사 확인이 실패 한도(429 ORGANIZATION-018)에 걸리면 잠시 후 다시 시도하라고 하고 입력은 남는다', async () => {
      const app = await openMyPage();
      app.server.on(
        'GET',
        COMPANY_LOOKUP_PATH,
        fail(429, OrganizationErrorCode.tooManyFailures),
      );
      await userEvent.press(button('조직 참여'));

      await findCompany('RBT124');

      expect(
        await screen.findByRole('header', {
          name: '잠시 후 다시 시도해 주세요',
        }),
      ).toBeOnTheScreen();
      await userEvent.press(button('확인'));
      expect(header('회사 찾기')).toBeOnTheScreen();
      expect(screen.getByLabelText('회사 코드 입력')).toHaveDisplayValue(
        'RBT124',
      );
    });

    it('역할 선택에서 이미 참여 중이라고 거절되면(ORGANIZATION-013) 안내 뒤 마이페이지로 간다', async () => {
      const app = await openMyPage();
      await userEvent.press(button('조직 참여'));
      await findCompany('RBT124');
      await screen.findByRole('header', { name: '역할을 선택해주세요' });
      app.server.on(
        'POST',
        PARTICIPATION_REQUESTS_PATH,
        fail(409, OrganizationErrorCode.alreadyMember),
      );

      await userEvent.press(screen.getByRole('radio', { name: /^기사/ }));
      await userEvent.press(button('참여 요청하기'));
      expect(
        await screen.findByRole('header', { name: '이미 참여 중인 회사예요' }),
      ).toBeOnTheScreen();
      await userEvent.press(button('확인'));

      expect(header('마이페이지')).toBeOnTheScreen();
      expect(header('역할을 선택해주세요')).toBeNull();
    });

    // 다른 기기에서 같은 회사에 먼저 요청했다
    it('역할 선택에서 승인 대기 요청이 있다고 거절되면(ORGANIZATION-014) 안내 뒤 신청 현황으로 가고, 뒤로 가면 마이페이지다', async () => {
      const app = await openMyPage();
      await userEvent.press(button('조직 참여'));
      await findCompany('RBT124');
      await screen.findByRole('header', { name: '역할을 선택해주세요' });
      await app.client.post(PARTICIPATION_REQUESTS_PATH, {
        companyCode: 'RBT124',
        desiredType: 'TECHNICIAN',
        requestChannel: 'QR_CODE',
      });

      await userEvent.press(screen.getByRole('radio', { name: /^기사/ }));
      await userEvent.press(button('참여 요청하기'));
      expect(
        await screen.findByRole('header', {
          name: '이미 참여를 요청한 회사예요',
        }),
      ).toBeOnTheScreen();
      await userEvent.press(button('확인'));

      expect(
        await screen.findByRole('header', { name: '승인 대기 3' }),
      ).toBeOnTheScreen();
      expect(screen.getByText('Orbit')).toBeOnTheScreen();
      await userEvent.press(button('뒤로 가기'));
      expect(header('마이페이지')).toBeOnTheScreen();
    });

    it('신청 현황에서 취소하려던 요청이 이미 처리됐으면(ORGANIZATION-017) 알리고 서버 목록으로 다시 그린다', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const app = await openMyPage();
      await userEvent.press(button('신청 현황, 2건'));
      await screen.findByRole('header', { name: '승인 대기 2' });
      participationOf(app.server).decide({ status: 'REJECTED' }, 1);

      await userEvent.press(button('한빛 설비 신청 취소'));
      await userEvent.press(button('취소'));
      await finishAnimations();

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '이미 처리된 요청이에요',
          '사무실이 이미 결정했거나 취소된 요청이라 취소할 수 없어요.',
        ),
      );
      expect(
        await screen.findByRole('header', { name: '승인 대기 1' }),
      ).toBeOnTheScreen();
      expect(app.server.callsTo('POST', cancelRequestPath('1'))).toHaveLength(
        1,
      );
    });

    // 승인되면 소속이 바뀐다. 기사 작업 화면이 쓰는 소속 조회(#114)를 다시 부르게 한다
    it('신청 현황을 새로 받아 승인을 확인하면 소속 조회를 무효로 만든다', async () => {
      const app = await openMyPage();
      app.queryClient.setQueryData(membershipsQueryKey, []);
      await userEvent.press(button('신청 현황, 2건'));
      await screen.findByRole('header', { name: '승인 대기 2' });
      expect(
        app.queryClient.getQueryState(membershipsQueryKey)?.isInvalidated,
      ).toBe(false);
      participationOf(app.server).decide({ status: 'APPROVED' }, 2);

      await fireEvent(screen.getByTestId('join-requests-list'), 'refresh');

      expect(
        await screen.findByRole('header', { name: '승인 대기 1' }),
      ).toBeOnTheScreen();
      expect(
        app.queryClient.getQueryState(membershipsQueryKey)?.isInvalidated,
      ).toBe(true);
    });

    it('마이페이지 신청 현황 배지는 서버 목록을 받지 못하면 두지 않는다', async () => {
      const app = await renderSignedInApp();
      app.server.on('GET', PARTICIPATION_REQUESTS_PATH, networkError());

      await userEvent.press(tab('마이'));

      // 받기 전에도 배지가 없으니, 실패가 화면에 반영된 뒤에 본다
      await waitFor(() =>
        expect(
          app.queryClient.getQueryState(participationRequestsKey)?.status,
        ).toBe('error'),
      );
      expect(button('신청 현황')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: /^신청 현황, / })).toBeNull();
    });

    // 마이페이지가 받아 둔 목록에서는 대기였던 요청이 그 뒤 거절됐다. 거절 화면은 캐시가 아니라 다시 받은 서버 목록으로 판단한다
    it('캐시에 대기로 남은 요청이 거절된 뒤 알림으로 열면 거절 화면과 서버의 거절 사유가 보인다', async () => {
      const app = await renderSignedInApp({
        requests: EXISTING_REQUESTS.map(item =>
          item.requestId === 3
            ? {
                ...item,
                status: 'PENDING',
                rejectReason: null,
                decidedAt: null,
              }
            : item,
        ),
      });
      await userEvent.press(tab('마이'));
      await screen.findByRole('button', { name: '신청 현황, 3건' });
      participationOf(app.server).decide(
        { status: 'REJECTED', rejectReason: '이번 달 채용이 마감되었습니다' },
        3,
      );

      await userEvent.press(button('알림센터'));
      await userEvent.press(
        await screen.findByRole('button', {
          name: /참여 요청이 거절되었습니다/,
        }),
      );

      expect(
        await screen.findByRole('header', { name: '참여 요청이 거절되었어요' }),
      ).toBeOnTheScreen();
      expect(
        screen.getByText('이번 달 채용이 마감되었습니다'),
      ).toBeOnTheScreen();
    });

    // 알림센터의 거절 화면은 서버 신청 현황에서 그 요청(알림의 participationRequestId = 서버 id 문자열)을 찾는다
    it('거절 화면은 신청 현황을 받지 못하면 다시 시도할 수 있고, 받으면 서버의 거절 사유를 보여준다', async () => {
      const app = await renderSignedInApp();
      let reachable = false;
      app.server.on('GET', PARTICIPATION_REQUESTS_PATH, () =>
        reachable
          ? ok({ requests: participationOf(app.server).requests })
          : networkError(),
      );
      await userEvent.press(tab('마이'));
      await userEvent.press(button('알림센터'));
      await userEvent.press(
        await screen.findByRole('button', {
          name: /참여 요청이 거절되었습니다/,
        }),
      );

      expect(
        await screen.findByText('참여 요청을 불러오지 못했어요.'),
      ).toBeOnTheScreen();
      expect(header('조직 참여하기')).toBeOnTheScreen();
      expect(tab('마이')).toBeSelected();

      reachable = true;
      await userEvent.press(button('다시 시도'));

      expect(
        await screen.findByRole('header', { name: '참여 요청이 거절되었어요' }),
      ).toBeOnTheScreen();
      expect(screen.getByText(REJECT_REASON)).toBeOnTheScreen();
      expect(screen.getByLabelText('회사, 스마트 홈케어')).toBeOnTheScreen();
    });
  });

  describe('하위 화면 공통', () => {
    const swipeArea = (title: string) => {
      let node = screen.getByRole('header', { name: title }).parent;
      while (node && !node.props.gestureResponseDistance) {
        node = node.parent;
      }
      return node?.props.gestureResponseDistance;
    };

    // [여는 방법, 스택 머리 제목, 화면을 알아볼 머리말]
    const screens = [
      ['회사 찾기', '조직 참여하기', '회사 찾기'],
      ['참여 신청 현황', '참여 신청 현황', '승인 대기 2'],
    ] as const;

    it.each(screens)(
      '%s 도 스와이프는 왼쪽 1/3, 열리면 제목 포커스, 두 손가락 Z 로 마이페이지에 돌아온다',
      async (name, title, marker) => {
        const focus = jest
          .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
          .mockClear();
        await openMyPage();
        await userEvent.press(
          button(name === '회사 찾기' ? '조직 참여' : '신청 현황, 2건'),
        );
        expect(header(marker)).toBeOnTheScreen();

        expect(swipeArea(title)).toEqual(
          expect.objectContaining({
            start: -1,
            end: Dimensions.get('window').width / 3,
          }),
        );
        await fireEvent(screen.getByRole('header', { name: title }), 'appear');
        expect(focus).toHaveBeenLastCalledWith(
          expect.objectContaining({
            props: expect.objectContaining({ children: title }),
          }),
          'focus',
        );

        await escapeFrom(title);
        expect(header('마이페이지')).toBeOnTheScreen();
      },
    );
  });
});
