import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, Platform, StatusBar } from 'react-native';
import { changeAppState, mockAppState } from '../../../../../jest/appState';
import { failCamera, scanQr } from '../../../../../jest/qrCamera';
import {
  fail,
  networkError,
  ok,
  type FakeResponse,
  type FakeServer,
} from '../../../../shared/testing/fakeServer';
import { renderWithApi } from '../../../../shared/testing/renderWithApi';
import { testSession } from '../../../../shared/testing/session';
import {
  COMPANY_LOOKUP_PATH,
  OrganizationErrorCode,
} from '../participationApi';
import { createParticipationServer, EXISTING_REQUESTS } from '../testing';
import { QrScanScreen } from './QrScanScreen';

// 회사 찾기 › QR 코드 인식 (#108). Figma 에 화면이 없어 최소 구성(전체 화면 카메라 + 가운데 사각 안내 + 닫기)이다.
// 카메라는 jest/qrCamera 의 목이고 scanQr 로 인식을 일으킨다. 회사 확인은 가짜 서버(features/my/org/testing)가 답한다:
// RBT124 Orbit, BS0001 이미 소속, HB0010 승인 대기 요청 있음, PRV014 폐기된 이전 코드
const orbit = { organizationId: '9', organizationName: 'Orbit' };
const orbitFound = {
  organizationId: 9,
  organizationName: 'Orbit',
  availability: 'AVAILABLE',
  pendingRequestId: null,
};
const JOIN_LINK = 'https://orbit.example/join/RBT124';

function renderScan(extra: Partial<Parameters<typeof QrScanScreen>[0]> = {}) {
  mockAppState('active');
  const participation = createParticipationServer({
    requests: EXISTING_REQUESTS,
  });
  const props = {
    focused: true,
    onClose: jest.fn(),
    onFound: jest.fn(),
    ...extra,
  };
  return renderWithApi(<QrScanScreen {...props} />, {
    server: participation.server,
    session: testSession(),
  }).then(view => ({ ...view, props }));
}

/** 회사 확인 응답을 테스트가 내보낼 때까지 잡아 둔다 */
function holdLookup(server: FakeServer) {
  let release: (response: FakeResponse) => void = () => {};
  server.on(
    'GET',
    COMPANY_LOOKUP_PATH,
    () =>
      new Promise<FakeResponse>(done => {
        release = done;
      }),
  );
  return (response: FakeResponse) => act(async () => release(response));
}

const lookups = (server: FakeServer) =>
  server.callsTo('GET', COMPANY_LOOKUP_PATH);
// 카메라 미리보기는 스크린리더에서 숨긴다
const camera = () =>
  screen.getByTestId('qr-camera', { includeHiddenElements: true });
const header = (name: string) => screen.queryByRole('header', { name });
const GUIDE = '회사에서 받은 QR 코드를 사각형 안에 비춰 주세요.';
const CHECK_FAILED =
  '회사를 확인하지 못했어요.\n다시 시도하거나 다른 QR 코드를 비춰 주세요.';
const UNRECOGNIZED =
  '인식할 수 없는 QR 코드예요.\n회사 참여 QR 코드를 비춰 주세요.';

describe('QrScanScreen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('전체 화면 카메라를 켜고 제목·닫기·가운데 사각 안내를 보여 준다', async () => {
    await renderScan();

    expect(camera()).toHaveProp('isActive', true);
    expect(
      screen.getByRole('header', { name: 'QR 코드 인식' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '닫기' })).toBeOnTheScreen();
    expect(screen.getByTestId('qr-guide-frame')).toBeOnTheScreen();
    expect(screen.getByText(GUIDE)).toBeOnTheScreen();
  });

  it('닫기를 누르면 onClose 를 부른다', async () => {
    const { props } = await renderScan();

    await userEvent.press(screen.getByRole('button', { name: '닫기' }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  describe('카메라 수명', () => {
    it('화면을 떠나면(포커스를 잃으면) 카메라를 끄고 인식하지 않는다', async () => {
      const { props, server, rerender } = await renderScan();

      await rerender(<QrScanScreen {...props} focused={false} />);
      await scanQr(JOIN_LINK);

      expect(camera()).toHaveProp('isActive', false);
      expect(lookups(server)).toHaveLength(0);

      await rerender(<QrScanScreen {...props} focused />);
      expect(camera()).toHaveProp('isActive', true);
    });

    it.each(['background', 'inactive'] as const)(
      '앱이 %s 로 가면 카메라를 끄고, 돌아오면 다시 켠다',
      async state => {
        const { server } = await renderScan();

        await changeAppState(state);
        await scanQr(JOIN_LINK);
        expect(camera()).toHaveProp('isActive', false);
        expect(lookups(server)).toHaveLength(0);

        await changeAppState('active');
        expect(camera()).toHaveProp('isActive', true);
      },
    );

    it('보이는 동안 상태 표시줄 글자를 흰색으로 두고, 떠나면 되돌린다', async () => {
      const push = jest.spyOn(StatusBar, 'pushStackEntry');
      const pop = jest.spyOn(StatusBar, 'popStackEntry');
      const { props, rerender } = await renderScan();
      expect(push).toHaveBeenLastCalledWith({ barStyle: 'light-content' });

      await rerender(<QrScanScreen {...props} focused={false} />);

      expect(pop).toHaveBeenCalledWith(push.mock.results[0]?.value);
    });

    it('카메라를 열지 못하면 카메라 대신 안내를 보여 준다', async () => {
      await renderScan();

      await failCamera();

      expect(
        screen.queryByTestId('qr-camera', { includeHiddenElements: true }),
      ).toBeNull();
      expect(
        screen.getByText(
          '카메라를 켜지 못했어요.\n설정에서 카메라 접근을 허용했는지 확인해 주세요.',
        ),
      ).toBeOnTheScreen();

      // 다시 시도하면 카메라를 다시 연다
      await userEvent.press(screen.getByRole('button', { name: '다시 시도' }));
      expect(camera()).toHaveProp('isActive', true);
      expect(screen.getByText(GUIDE)).toBeOnTheScreen();
    });

    // iOS 첫 권한 대화상자가 닫히며 앱이 active 로 돌아오는 순간이 첫 렌더와 구독 사이에 끼면 이벤트를 놓친다
    it('그린 뒤 구독하기 전에 앱이 active 가 됐어도 카메라를 켠다', async () => {
      const { props } = await renderScan();
      let reads = 0;
      Object.defineProperty(AppState, 'currentState', {
        get: () => (reads++ === 0 ? 'inactive' : 'active'),
        configurable: true,
      });

      await screen.rerender(<QrScanScreen {...props} key="again" />);

      expect(camera()).toHaveProp('isActive', true);
    });
  });

  describe('인식한 QR', () => {
    it('회사 코드가 든 QR 이면 그 코드로 회사를 확인하고, 찾은 회사를 QR 경로의 참여 대상으로 넘긴다', async () => {
      const { props, server } = await renderScan();

      await scanQr(JOIN_LINK);

      await waitFor(() =>
        expect(props.onFound).toHaveBeenCalledWith({
          ...orbit,
          companyCode: 'RBT124',
          requestChannel: 'QR_CODE',
        }),
      );
      expect(lookups(server)[0].query).toEqual({ companyCode: 'RBT124' });
    });

    it('같은 QR 을 연속으로 인식해도 회사 확인은 한 번만 한다', async () => {
      const { props, server } = await renderScan();
      const respond = holdLookup(server);

      await scanQr(JOIN_LINK);
      await scanQr(JOIN_LINK);
      await scanQr(JOIN_LINK, JOIN_LINK);
      await respond(ok(orbitFound));
      await scanQr(JOIN_LINK);

      expect(lookups(server)).toHaveLength(1);
      expect(props.onFound).toHaveBeenCalledTimes(1);
    });

    it('확인하는 동안에는 다른 QR 도 확인하지 않고, 확인 중이라고 알린다', async () => {
      const { server } = await renderScan();
      const respond = holdLookup(server);

      await scanQr(JOIN_LINK);
      expect(screen.getByText('회사를 확인하고 있어요.')).toBeOnTheScreen();
      await scanQr('HB0010');
      await respond(ok(orbitFound));

      expect(lookups(server)).toHaveLength(1);
    });

    it('한 프레임에 QR 이 여럿이면 회사 코드가 든 첫 QR 로 확인한다', async () => {
      const { props } = await renderScan();

      await scanQr('WIFI:S:office;;', JOIN_LINK, 'HB0010');

      await waitFor(() =>
        expect(props.onFound).toHaveBeenCalledWith(
          expect.objectContaining({ companyCode: 'RBT124' }),
        ),
      );
    });

    it('회사 코드가 없는 QR 이면 인식할 수 없다고 알리고 회사를 확인하지 않는다', async () => {
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockClear();
      const { server } = await renderScan();

      await scanQr('WIFI:S:office;T:WPA;P:secret;;');

      expect(screen.getByText(UNRECOGNIZED)).toBeOnTheScreen();
      expect(announce).toHaveBeenCalledWith(UNRECOGNIZED.replace('\n', ' '));
      expect(lookups(server)).toHaveLength(0);

      // 같은 QR 이 계속 보여도 다시 알리지 않는다. 회사 QR 을 비추면 확인한다
      await scanQr('WIFI:S:office;T:WPA;P:secret;;');
      expect(announce).toHaveBeenCalledTimes(1);
      await scanQr(JOIN_LINK);
      await waitFor(() => expect(lookups(server)).toHaveLength(1));
    });

    // Android 는 live region 이 읽으므로 한 번 더 알리면 두 번 읽는다
    it('Android 는 live region 만으로 읽고 따로 알리지 않는다', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockClear();
      await renderScan();

      await scanQr('hello');

      expect(screen.getByText(UNRECOGNIZED)).toBeOnTheScreen();
      expect(announce).not.toHaveBeenCalled();
    });
  });

  describe('회사 확인 결과 (회사 코드 입력과 같은 갈래)', () => {
    it.each([
      ['없는 코드(ORGANIZATION-011)', 'https://orbit.example/join/WRNG99'],
      ['회사가 바꿔 폐기된 이전 코드(ORGANIZATION-012)', 'PRV014'],
    ])(
      '%s 면 유효하지 않은 회사 코드 안내를 띄우고, 닫아도 같은 QR 은 다시 확인하지 않는다',
      async (_, value) => {
        const { props, server } = await renderScan();

        await scanQr(value);

        expect(
          await screen.findByRole('header', {
            name: '유효하지 않은 회사 코드입니다',
          }),
        ).toBeOnTheScreen();
        expect(
          screen.getByText(
            '회사에서 코드를 변경해\n이전 참여 경로를 사용할 수 없습니다.',
          ),
        ).toBeOnTheScreen();
        await userEvent.press(screen.getByRole('button', { name: '확인' }));
        expect(header('유효하지 않은 회사 코드입니다')).toBeNull();

        await scanQr(value);
        expect(lookups(server)).toHaveLength(1);
        expect(props.onFound).not.toHaveBeenCalled();
        expect(camera()).toHaveProp('isActive', true);
      },
    );

    it('안내가 떠 있는 동안에는 다른 QR 도 확인하지 않는다', async () => {
      const { server } = await renderScan();
      await scanQr('PRV014');
      await screen.findByRole('header', {
        name: '유효하지 않은 회사 코드입니다',
      });

      await scanQr(JOIN_LINK);

      expect(lookups(server)).toHaveLength(1);
    });

    it('이미 소속된 회사면 이미 참여 안내를 띄운다', async () => {
      const { props } = await renderScan();

      await scanQr('BS0001');

      expect(
        await screen.findByRole('header', { name: '이미 참여 중인 회사예요' }),
      ).toBeOnTheScreen();
      expect(props.onFound).not.toHaveBeenCalled();
    });

    it('승인 대기 요청이 있는 회사면 승인 대기 안내를 띄운다', async () => {
      await renderScan();

      await scanQr('HB0010');

      expect(
        await screen.findByRole('header', {
          name: '이미 참여를 요청한 회사예요',
        }),
      ).toBeOnTheScreen();
    });

    // 온보딩은 알림 대신 그 요청의 화면으로 간다 (회사 찾기와 같다)
    it('onPending·onAlreadyMember 를 주면 안내 대신 바깥에 맡긴다', async () => {
      const onPending = jest.fn();
      const onAlreadyMember = jest.fn(async () => true);
      await renderScan({ onPending, onAlreadyMember });

      await scanQr('HB0010');
      await waitFor(() =>
        expect(onPending).toHaveBeenCalledWith(
          { organizationId: '10', organizationName: '한빛 설비' },
          '1',
        ),
      );
      await scanQr('BS0001');
      await waitFor(() =>
        expect(onAlreadyMember).toHaveBeenCalledWith({
          organizationId: '1',
          organizationName: '오빗 서비스',
        }),
      );
      expect(header('이미 참여를 요청한 회사예요')).toBeNull();
      expect(header('이미 참여 중인 회사예요')).toBeNull();
    });

    // 오프라인·실패 한도(429)에서 같은 QR 이 계속 보여도 안내가 되풀이되지 않게, 실패 뒤에는 저절로 다시 묻지 않는다
    it.each([
      ['네트워크 오류', networkError()],
      ['서버 오류(500)', fail(500, 'COMMON-500')],
    ])(
      '%s 면 확인하지 못했다고 알리고, 닫은 뒤 같은 QR 이 계속 보여도 다시 묻지 않고 다시 시도로만 묻는다',
      async (_, response) => {
        const { props, server } = await renderScan();
        server.on('GET', COMPANY_LOOKUP_PATH, response, ok(orbitFound));

        await scanQr(JOIN_LINK);
        expect(
          await screen.findByRole('header', {
            name: '회사를 확인하지 못했어요',
          }),
        ).toBeOnTheScreen();
        await scanQr(JOIN_LINK);
        expect(lookups(server)).toHaveLength(1);

        await userEvent.press(screen.getByRole('button', { name: '확인' }));
        await scanQr(JOIN_LINK);
        await scanQr(JOIN_LINK);
        expect(lookups(server)).toHaveLength(1);
        expect(screen.getByText(CHECK_FAILED)).toBeOnTheScreen();

        await userEvent.press(
          screen.getByRole('button', { name: '다시 시도' }),
        );

        await waitFor(() => expect(props.onFound).toHaveBeenCalledTimes(1));
        expect(lookups(server)).toHaveLength(2);
        expect(lookups(server)[1].query).toEqual({ companyCode: 'RBT124' });
      },
    );

    it('실패 한도(429 ORGANIZATION-018)도 닫은 뒤 같은 QR 로 다시 묻지 않는다. 다른 QR 은 확인한다', async () => {
      const { server } = await renderScan();
      server.on(
        'GET',
        COMPANY_LOOKUP_PATH,
        fail(429, OrganizationErrorCode.tooManyFailures),
      );

      await scanQr(JOIN_LINK);
      await userEvent.press(
        await screen.findByRole('button', { name: '확인' }),
      );
      await scanQr(JOIN_LINK);
      expect(lookups(server)).toHaveLength(1);

      await scanQr('HB0010');
      await waitFor(() => expect(lookups(server)).toHaveLength(2));
    });

    // 찾은 회사로 데려가지 못했으면(그사이 다른 화면이 올라옴) 돌아왔을 때 같은 QR 로 다시 찾는다
    it('화면을 떠났다 돌아오면 같은 QR 도 다시 확인한다', async () => {
      const { props, server, rerender } = await renderScan();
      await scanQr(JOIN_LINK);
      await waitFor(() => expect(props.onFound).toHaveBeenCalledTimes(1));

      await rerender(<QrScanScreen {...props} focused={false} />);
      await rerender(<QrScanScreen {...props} focused />);
      await scanQr(JOIN_LINK);

      await waitFor(() => expect(props.onFound).toHaveBeenCalledTimes(2));
      expect(lookups(server)).toHaveLength(2);
    });

    it('돌아왔을 때 미뤄 둔 실패 안내가 있으면 닫은 뒤에도 같은 QR 로 다시 묻지 않는다', async () => {
      const { server, props, rerender } = await renderScan();
      server.on('GET', COMPANY_LOOKUP_PATH, networkError());
      const respond = holdLookup(server);
      await scanQr(JOIN_LINK);
      await rerender(<QrScanScreen {...props} focused={false} />);
      await respond(networkError());

      await rerender(<QrScanScreen {...props} focused />);
      await userEvent.press(screen.getByRole('button', { name: '확인' }));
      await scanQr(JOIN_LINK);

      expect(lookups(server)).toHaveLength(1);
    });

    // 확인하는 사이 다른 화면이 올라오면(알림 등) RN Modal 이 그 화면 위에 뜬다 (#116 회사 찾기와 같다)
    it('화면이 보이지 않는 동안 온 안내는 띄우지 않고, 돌아오면 띄운다', async () => {
      const { server, props, rerender } = await renderScan();
      const respond = holdLookup(server);
      await scanQr(JOIN_LINK);

      await rerender(<QrScanScreen {...props} focused={false} />);
      await respond(fail(429, OrganizationErrorCode.tooManyFailures));
      expect(header('잠시 후 다시 시도해 주세요')).toBeNull();

      await rerender(<QrScanScreen {...props} focused />);
      expect(
        screen.getByRole('header', { name: '잠시 후 다시 시도해 주세요' }),
      ).toBeOnTheScreen();
    });

    it('확인하는 동안 화면을 떠나면 요청을 끊고 늦은 결과로 넘기지 않는다', async () => {
      const { server, props, unmount } = await renderScan();
      const respond = holdLookup(server);
      await scanQr(JOIN_LINK);

      await unmount();
      await respond(ok(orbitFound));

      expect(lookups(server)[0].signal?.aborted).toBe(true);
      expect(props.onFound).not.toHaveBeenCalled();
    });
  });
});
