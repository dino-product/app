import { act, screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, Platform, StatusBar } from 'react-native';
import { changeAppState, mockAppState } from '../../../../../jest/appState';
import { failCamera, scanQr } from '../../../../../jest/qrCamera';
import type { FakeServer } from '../../../../shared/testing/fakeServer';
import { MIN_SCREEN_TOP } from '../../../../shared/layout/ScreenSafeAreaView';
import { renderWithApi } from '../../../../shared/testing/renderWithApi';
import { testSession } from '../../../../shared/testing/session';
import { COMPANY_LOOKUP_PATH } from '../participationApi';
import { createParticipationServer, EXISTING_REQUESTS } from '../testing';
import { QrScanScreen } from './QrScanScreen';

// 회사 찾기 › QR 코드 인식 (#108). Figma 에 화면이 없어 최소 구성(전체 화면 카메라 + 가운데 사각 안내 + 닫기)이다.
// 카메라는 jest/qrCamera 의 목이고 scanQr 로 인식을 일으킨다. 회사 코드를 읽으면 카메라를 끄고 코드만 넘긴다 (#195).
// 회사 확인은 돌아간 회사 찾기 화면이 한다. 여기서는 가짜 서버(features/my/org/testing)로 서버에 묻지 않는 것만 본다
const JOIN_LINK = 'https://orbit.example/join/RBT124';

function renderScan(extra: Partial<Parameters<typeof QrScanScreen>[0]> = {}) {
  mockAppState('active');
  const participation = createParticipationServer({
    requests: EXISTING_REQUESTS,
  });
  const props = {
    focused: true,
    onClose: jest.fn(),
    onScanned: jest.fn(),
    ...extra,
  };
  return renderWithApi(<QrScanScreen {...props} />, {
    server: participation.server,
    session: testSession(),
  }).then(view => ({ ...view, props }));
}

const lookups = (server: FakeServer) =>
  server.callsTo('GET', COMPANY_LOOKUP_PATH);
// 카메라 미리보기는 스크린리더에서 숨긴다
const camera = () =>
  screen.getByTestId('qr-camera', { includeHiddenElements: true });
const header = (name: string) => screen.queryByRole('header', { name });
const GUIDE = '회사에서 받은 QR 코드를 사각형 안에 비춰 주세요.';
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
      const { props, rerender } = await renderScan();

      await rerender(<QrScanScreen {...props} focused={false} />);
      await scanQr(JOIN_LINK);

      expect(camera()).toHaveProp('isActive', false);
      expect(props.onScanned).not.toHaveBeenCalled();

      await rerender(<QrScanScreen {...props} focused />);
      expect(camera()).toHaveProp('isActive', true);
    });

    it.each(['background', 'inactive'] as const)(
      '앱이 %s 로 가면 카메라를 끄고, 돌아오면 다시 켠다',
      async state => {
        const { props } = await renderScan();

        await changeAppState(state);
        await scanQr(JOIN_LINK);
        expect(camera()).toHaveProp('isActive', false);
        expect(props.onScanned).not.toHaveBeenCalled();

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

  // QR 화면은 회사 코드만 읽고 닫힌다 (#195). 회사 확인과 그 결과(모달·역할 선택)는 돌아간 회사 찾기 화면이 보인다
  describe('인식한 QR', () => {
    it('회사 코드가 든 QR 이면 카메라를 끄고 그 코드를 넘긴다. 회사는 여기서 확인하지 않는다', async () => {
      const { props, server } = await renderScan();

      await scanQr(JOIN_LINK);

      expect(props.onScanned).toHaveBeenCalledWith('RBT124');
      expect(camera()).toHaveProp('isActive', false);
      expect(lookups(server)).toHaveLength(0);
    });

    // 폐기된 이전 코드인지는 서버만 안다. 결과 안내는 카메라 위가 아니라 돌아간 앱 화면 위에 뜬다
    it('폐기된 이전 코드의 QR 도 코드만 넘기고 카메라 위에 안내를 띄우지 않는다', async () => {
      const { props } = await renderScan();

      await scanQr('https://orbit.example/join/PRV014');

      expect(props.onScanned).toHaveBeenCalledWith('PRV014');
      expect(header('유효하지 않은 회사 코드입니다')).toBeNull();
      expect(screen.queryByRole('button', { name: '확인' })).toBeNull();
    });

    it('한 번 인식하면 같은 QR·다른 회사 QR 이 계속 보여도 다시 넘기지 않는다', async () => {
      const { props } = await renderScan();

      await scanQr(JOIN_LINK);
      await scanQr(JOIN_LINK, JOIN_LINK);
      await scanQr('HB0010');

      expect(props.onScanned).toHaveBeenCalledTimes(1);
    });

    // 카메라는 프레임마다 부른다. 카메라를 끄는 렌더가 반영되기 전에 온 다음 프레임도 넘기지 않는다
    it('다시 그리기 전에 연달아 온 프레임도 한 번만 넘긴다', async () => {
      const { props } = await renderScan();

      await act(async () => {
        await scanQr(JOIN_LINK);
        await scanQr('HB0010');
      });

      expect(props.onScanned).toHaveBeenCalledTimes(1);
      expect(props.onScanned).toHaveBeenCalledWith('RBT124');
    });

    it('한 프레임에 QR 이 여럿이면 회사 코드가 든 첫 QR 의 코드를 넘긴다', async () => {
      const { props } = await renderScan();

      await scanQr('WIFI:S:office;;', JOIN_LINK, 'HB0010');

      expect(props.onScanned).toHaveBeenCalledTimes(1);
      expect(props.onScanned).toHaveBeenCalledWith('RBT124');
    });

    // 우리 QR 이 아니면 돌아갈 결과가 없다. 카메라에 머물러 다른 QR 을 비추게 한다 (#108 그대로)
    it('회사 코드가 없는 QR 이면 인식할 수 없다고 알리고 카메라에 머문다', async () => {
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockClear();
      const { props, server } = await renderScan();

      await scanQr('WIFI:S:office;T:WPA;P:secret;;');

      expect(screen.getByText(UNRECOGNIZED)).toBeOnTheScreen();
      expect(announce).toHaveBeenCalledWith(UNRECOGNIZED.replace('\n', ' '));
      expect(props.onScanned).not.toHaveBeenCalled();
      expect(camera()).toHaveProp('isActive', true);
      expect(lookups(server)).toHaveLength(0);

      // 같은 QR 이 계속 보여도 다시 알리지 않는다. 회사 QR 을 비추면 그 코드를 넘긴다
      await scanQr('WIFI:S:office;T:WPA;P:secret;;');
      expect(announce).toHaveBeenCalledTimes(1);
      await scanQr(JOIN_LINK);
      expect(props.onScanned).toHaveBeenCalledWith('RBT124');
    });

    // 화면이 닫히는 동안 방금 비춘 회사 QR 을 두고 '인식할 수 없다' 고 보이지 않게 한다
    it('일반 QR 다음 회사 QR 을 읽으면 인식할 수 없다는 안내를 거두고 기본 안내로 돌아간다', async () => {
      const { props } = await renderScan();
      await scanQr('WIFI:S:office;;');
      expect(screen.getByText(UNRECOGNIZED)).toBeOnTheScreen();

      await scanQr(JOIN_LINK);

      expect(props.onScanned).toHaveBeenCalledWith('RBT124');
      expect(screen.queryByText(UNRECOGNIZED)).toBeNull();
      expect(screen.getByText(GUIDE)).toBeOnTheScreen();
    });

    // 화면이 닫히는 동안 TalkBack 이 바뀐 안내를 읽지 않게 한다
    it('회사 QR 을 읽은 뒤에는 안내의 live region 을 끈다', async () => {
      await renderScan();
      await scanQr('WIFI:S:office;;');
      expect(screen.getByText(UNRECOGNIZED)).toHaveProp(
        'accessibilityLiveRegion',
        'polite',
      );

      await scanQr(JOIN_LINK);

      expect(screen.getByText(GUIDE)).toHaveProp(
        'accessibilityLiveRegion',
        'none',
      );
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
  // 닫기 머리는 다른 화면처럼 화면 위 여백(Android 는 상태 표시줄과 60 중 큰 값) 아래에 둔다 (#236)
  it('닫기 머리는 화면 틀 규칙대로 위 여백을 둔다', async () => {
    await renderScan();

    const [frame] = screen.container.queryAll(
      node => node.props.edges !== undefined,
    );
    expect(frame?.props.edges).toEqual({
      top: 'maximum',
      bottom: 'off',
      left: 'off',
      right: 'off',
    });
    expect(frame).toHaveStyle({ paddingTop: MIN_SCREEN_TOP });
  });
});
