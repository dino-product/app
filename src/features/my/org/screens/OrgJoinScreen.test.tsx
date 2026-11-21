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
  Keyboard,
  Linking,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  type AlertButton,
} from 'react-native';
import {
  colors,
  MIN_TOUCH_TARGET,
  typography,
  withOpacity,
} from '../../../../shared/design-system';
import * as cameraPermissionModule from '../../../../shared/native/NativeCameraPermissionIOS';
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
import { OrgJoinScreen } from './OrgJoinScreen';

// iOS 카메라 권한 앱 모듈. 테스트에는 네이티브 모듈이 없어 목으로 둔다 (QR 코드 인식, #108)
jest.mock('../../../../shared/native/NativeCameraPermissionIOS', () => ({
  __esModule: true,
  default: { getStatus: jest.fn(), request: jest.fn() },
}));
const cameraPermission = jest.mocked(cameraPermissionModule.default!);

// 회사 확인은 가짜 서버(src/features/my/org/testing)가 답한다. 가입을 마친 계정이라 한빛 설비(HB0010)에 승인 대기 요청이 있다
const orbit = { organizationId: '9', organizationName: 'Orbit' };
const orbitFound = {
  organizationId: 9,
  organizationName: 'Orbit',
  availability: 'AVAILABLE',
  pendingRequestId: null,
};

function renderJoin(extra: Partial<Parameters<typeof OrgJoinScreen>[0]> = {}) {
  const participation = createParticipationServer({
    requests: EXISTING_REQUESTS,
  });
  const props = {
    onBack: jest.fn(),
    onFound: jest.fn(),
    onScanQr: jest.fn(),
    ...extra,
  };
  return renderWithApi(<OrgJoinScreen {...props} />, {
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
const codeInput = () => screen.getByLabelText('회사 코드 입력');
const checkButton = () => screen.getByRole('button', { name: '회사 확인' });
const header = (name: string) => screen.queryByRole('header', { name });

describe('OrgJoinScreen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('제목은 조직 참여하기이고 회사 찾기 안내를 보여준다', async () => {
    await renderJoin();

    expect(
      screen.getByRole('header', { name: '조직 참여하기' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: '회사 찾기' })).toBeOnTheScreen();
    expect(
      screen.getByText('회사 코드·참여 링크·QR로 회사를 찾을 수 있습니다.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('회사 관리자에게 받은 코드를 입력해 주세요.'),
    ).toBeOnTheScreen();
  });

  // 마이 Figma 3235:17258 / 3255:18332, 온보딩 3278:23180: 글자는 칸 왼쪽 16 에서 시작한다 (#151)
  it.each([
    ['my', 56],
    ['onboarding', 46],
  ] as const)(
    '%s 회사 코드 입력칸은 Figma 대로 높이 %i·가로 여백 16 이다',
    async (flow, height) => {
      await renderJoin({ flow });

      expect(codeInput()).toHaveStyle({
        // 온보딩은 Android 최소 터치 영역(48)까지 키운다 (#85)
        minHeight: Math.max(height, MIN_TOUCH_TARGET),
        paddingHorizontal: 16,
      });
    },
  );

  // 마이 › 조직 참여하기의 회사 찾기. Figma 회사찾기 3255:18315 의 본문(3255:18323), 3235:17242·51028:17074·3255:18149 도 같은 값.
  // 이 화면 위에 QR 결과를 띄운다 (#195)
  describe('마이 Figma 값 (3255:18323)', () => {
    const hidden = (text: string) =>
      screen.getByText(text, { includeHiddenElements: true });

    it('소개: 제목 Body/L/Bold Gray900, 설명 Body/XS/Medium Gray600, 사이 6. 소개·입력·구분선·QR 사이 24', async () => {
      await renderJoin();

      const title = screen.getByRole('header', { name: '회사 찾기' });
      expect(title).toHaveStyle({
        ...typography['Body/L/Bold'],
        color: colors.gray[900],
      });
      expect(
        screen.getByText('회사 코드·참여 링크·QR로 회사를 찾을 수 있습니다.'),
      ).toHaveStyle({
        ...typography['Body/XS/Medium'],
        color: colors.gray[600],
      });
      expect(title.parent).toHaveStyle({ gap: 6 });
      // 소개·입력·구분선·QR 은 스크롤 내용 칸에 나란히 있다
      const scroll = title.parent?.parent?.parent;
      expect(scroll?.type).toBe('RCTScrollView');
      expect(StyleSheet.flatten(scroll?.props.contentContainerStyle)).toEqual(
        expect.objectContaining({ gap: 24 }),
      );
    });

    it('회사 코드 입력: 라벨 Caption/M/Medium Gray700 아래 8, 입력줄 아래 12 에 도움말 Caption/S/Medium 라이브러리 Gray500', async () => {
      await renderJoin();

      const label = hidden('회사 코드 입력');
      expect(label).toHaveStyle({
        ...typography['Caption/M/Medium'],
        color: colors.gray[700],
      });
      expect(label.parent).toHaveStyle({ gap: 8 });
      const help = screen.getByText(
        '회사 관리자에게 받은 코드를 입력해 주세요.',
      );
      expect(help).toHaveStyle({
        ...typography['Caption/S/Medium'],
        color: colors.libraryGray[500],
      });
      expect(help.parent).toHaveStyle({ gap: 12 });
    });

    // 3255:18332 입력칸 모서리 14·테두리 Gray100·플레이스홀더 Gray500, 회사 확인(3255:18334)과 사이 10, 버튼 좌우 16·폭 102
    it('입력칸은 모서리 14·테두리 Gray100·플레이스홀더 Gray500 이고, 회사 확인과 10 떨어진다. 회사 확인은 좌우 16·폭 102', async () => {
      await renderJoin();

      expect(codeInput()).toHaveStyle({
        borderRadius: 14,
        borderColor: colors.gray[100],
        marginRight: 10,
      });
      expect(codeInput().props.placeholderTextColor).toBe(colors.gray[500]);
      expect(checkButton()).toHaveStyle({
        paddingHorizontal: 16,
        minWidth: 102,
      });
    });

    // 3255:18336 Alternative divider: 선 Gray400 30%, '또는' Caption/M/Regular Gray400
    it("구분선은 Gray400 30% 이고 '또는' 은 Caption/M/Regular Gray400 이다", async () => {
      await renderJoin();

      const or = hidden('또는');
      expect(or).toHaveStyle({
        ...typography['Caption/M/Regular'],
        color: colors.gray[400],
      });
      const [line] = or.parent?.children ?? [];
      expect(line).toHaveStyle({
        height: 1,
        backgroundColor: withOpacity(colors.gray[400], 0.3),
      });
    });

    // 온보딩 회사 찾기(3205:6299 · 3278:23116)는 입력칸 46·모서리 12 로 따로다
    it('온보딩 입력칸 모서리는 12 그대로다', async () => {
      await renderJoin({ flow: 'onboarding' });

      expect(codeInput()).toHaveStyle({ borderRadius: 12 });
    });
  });

  // 서버 규칙 (Dino CompanyCode): Crockford Base32 대문자 6자 (#97)
  describe('회사 코드 규칙', () => {
    it('회사 확인은 정확히 6자일 때만 켜진다 (0~5자는 비활성)', async () => {
      await renderJoin();

      expect(checkButton()).toBeDisabled();
      await userEvent.type(codeInput(), '   ');
      expect(checkButton()).toBeDisabled();
      for (const char of 'AB123') {
        await userEvent.type(codeInput(), char);
        expect(checkButton()).toBeDisabled();
      }
      await userEvent.type(codeInput(), 'C');
      expect(checkButton()).toBeEnabled();
    });

    it('입력하는 글자는 대문자로 바뀌고, 허용 밖 문자(한글·특수문자·I·L·O·U)는 들어가지 않고, 6자를 넘지 않는다', async () => {
      await renderJoin();

      await userEvent.type(codeInput(), 'a가b!-o c1i2l3u4567');

      expect(codeInput()).toHaveDisplayValue('ABC123');
    });

    it('6자가 찬 칸에 끼워 넣은 글자는 들어가지 않고 끝 글자도 지워지지 않는다', async () => {
      await renderJoin();
      await userEvent.type(codeInput(), 'AB123C');

      // 맨 앞에 커서를 두고 X 를 입력한 경우
      await fireEvent.changeText(codeInput(), 'XAB123C');

      expect(codeInput()).toHaveDisplayValue('AB123C');
    });

    it('붙여넣은 ab-12 3c 는 AB123C 가 된다', async () => {
      await renderJoin();

      await userEvent.paste(codeInput(), 'ab-12 3c');

      expect(codeInput()).toHaveDisplayValue('AB123C');
      expect(checkButton()).toBeEnabled();
    });

    it('키보드 완료도 6자가 아니면 찾지 않는다', async () => {
      const { server } = await renderJoin();

      await userEvent.type(codeInput(), 'AB123', { submitEditing: true });
      expect(lookups(server)).toHaveLength(0);

      await userEvent.type(codeInput(), 'C', { submitEditing: true });
      await waitFor(() => expect(lookups(server)).toHaveLength(1));
      expect(lookups(server)[0].query).toEqual({ companyCode: 'AB123C' });
    });

    // 영문이 섞여 숫자 키패드는 쓰지 않는다. 한글 IME·추천·자동 수정이 끼어들지 않게 한다
    it('iOS 는 영문·숫자 자판(ascii-capable)으로 열고 자동 대문자, 자동 수정은 끈다', async () => {
      await renderJoin();

      expect(codeInput()).toHaveProp('keyboardType', 'ascii-capable');
      expect(codeInput()).toHaveProp('autoCapitalize', 'characters');
      expect(codeInput()).toHaveProp('autoCorrect', false);
      expect(codeInput()).toHaveProp('autoComplete', 'off');
    });

    it('Android 는 한글 IME·추천이 뜨지 않는 자판(visible-password)으로 연다', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      await renderJoin();

      expect(codeInput()).toHaveProp('keyboardType', 'visible-password');
      expect(codeInput()).toHaveProp('autoCapitalize', 'characters');
      expect(codeInput()).toHaveProp('autoCorrect', false);
    });
  });

  // 카메라 권한을 받은 뒤 QR 스캔 화면을 연다 (#108). 권한은 shared/native/cameraPermission 이 묻는다
  describe('QR 코드 인식 (#108)', () => {
    const qrButton = () => screen.getByRole('button', { name: 'QR 코드 인식' });
    // 안내(Alert)는 띄우지 않고 기록만 한다
    const spyAlert = () =>
      jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const pressAlertButton = (
      alert: ReturnType<typeof spyAlert>,
      text: string,
    ) =>
      ((alert.mock.calls[0]?.[2] ?? []) as AlertButton[])
        .find(button => button.text === text)
        ?.onPress?.();
    const GUIDE_TITLE = '카메라 권한이 필요해요';
    const GUIDE_MESSAGE =
      'QR 코드를 인식하려면 설정에서 카메라 접근을 허용해 주세요.';

    afterEach(() => {
      // 모듈 목은 restoreAllMocks 로 호출 기록이 지워지지 않는다
      cameraPermission.getStatus.mockReset();
      cameraPermission.request.mockReset();
      jest.mocked(Linking.openSettings).mockReset();
    });

    it.each(['my', 'onboarding'] as const)(
      '%s: QR 코드 인식을 누르면 카메라 권한을 묻고, 허용하면 QR 스캔 화면을 연다',
      async flow => {
        cameraPermission.getStatus.mockReturnValue('not-determined');
        cameraPermission.request.mockResolvedValue(true);
        const { props } = await renderJoin({ flow });

        expect(qrButton()).toBeEnabled();
        await userEvent.press(qrButton());

        expect(cameraPermission.request).toHaveBeenCalledTimes(1);
        expect(props.onScanQr).toHaveBeenCalledTimes(1);
      },
    );

    // 권한을 묻는 동안(시스템 대화상자 없이 끝나는 Android 확인 포함) 회사 확인을 시작했으면, 카메라를 열어도 읽어 온 코드가
    // 확인 중이라 바로 확인되지 못한다. 열지 않는다 (#195)
    it('권한을 묻는 사이 회사 확인이 시작되면 카메라를 열지 않는다', async () => {
      let grant: (granted: boolean) => void = () => {};
      cameraPermission.getStatus.mockReturnValue('not-determined');
      cameraPermission.request.mockImplementation(
        () =>
          new Promise<boolean>(done => {
            grant = done;
          }),
      );
      const { props, server } = await renderJoin();
      const respond = holdLookup(server);

      await userEvent.press(qrButton());
      await userEvent.type(codeInput(), 'RBT124');
      await userEvent.press(checkButton());
      await act(async () => grant(true));

      expect(props.onScanQr).not.toHaveBeenCalled();
      await respond(ok(orbitFound));
      expect(props.onFound).toHaveBeenCalledTimes(1);
    });

    // 입력하던 키보드가 카메라 화면 위에 남지 않게 한다
    it('누르면 키보드를 내린다', async () => {
      cameraPermission.getStatus.mockReturnValue('granted');
      const dismiss = jest.spyOn(Keyboard, 'dismiss');
      await renderJoin();

      await userEvent.press(qrButton());

      expect(dismiss).toHaveBeenCalled();
    });

    it('이미 허용했으면 묻지 않고 연다', async () => {
      cameraPermission.getStatus.mockReturnValue('granted');
      const { props } = await renderJoin();

      await userEvent.press(qrButton());

      expect(cameraPermission.request).not.toHaveBeenCalled();
      expect(props.onScanQr).toHaveBeenCalledTimes(1);
    });

    it.each([
      { status: 'not-determined', asked: false },
      { status: 'denied', asked: undefined },
      { status: 'restricted', asked: undefined },
    ])(
      'iOS 권한이 $status(물은 결과 $asked)면 열지 않고 설정으로 가는 안내를 띄운다',
      async ({ status, asked }) => {
        cameraPermission.getStatus.mockReturnValue(status);
        if (asked !== undefined) {
          cameraPermission.request.mockResolvedValue(asked);
        }
        jest.mocked(Linking.openSettings).mockResolvedValue(undefined);
        const alert = spyAlert();
        const { props } = await renderJoin();

        await userEvent.press(qrButton());

        expect(props.onScanQr).not.toHaveBeenCalled();
        expect(alert).toHaveBeenCalledTimes(1);
        expect(alert.mock.calls[0]?.[0]).toBe(GUIDE_TITLE);
        expect(alert.mock.calls[0]?.[1]).toBe(GUIDE_MESSAGE);
        pressAlertButton(alert, '설정으로 이동');
        expect(Linking.openSettings).toHaveBeenCalledTimes(1);
      },
    );

    it.each([
      ['granted', true],
      ['denied', false],
      ['never_ask_again', false],
    ] as const)(
      'Android 는 런타임 CAMERA 권한이 %s 면 여는가: %s',
      async (result, opens) => {
        jest.replaceProperty(Platform, 'OS', 'android');
        const request = jest
          .spyOn(PermissionsAndroid, 'request')
          .mockResolvedValue(result);
        const alert = spyAlert();
        const { props } = await renderJoin();

        await userEvent.press(qrButton());

        expect(request).toHaveBeenCalledWith(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );
        expect(props.onScanQr).toHaveBeenCalledTimes(opens ? 1 : 0);
        expect(alert).toHaveBeenCalledTimes(opens ? 0 : 1);
      },
    );

    it('권한을 묻는 동안 다시 눌러도 한 번만 묻고 한 번만 연다', async () => {
      cameraPermission.getStatus.mockReturnValue('not-determined');
      let allow: (granted: boolean) => void = () => {};
      cameraPermission.request.mockReturnValue(
        new Promise(done => {
          allow = done;
        }),
      );
      const { props } = await renderJoin();

      await userEvent.press(qrButton());
      await userEvent.press(qrButton());
      await act(async () => allow(true));

      expect(cameraPermission.request).toHaveBeenCalledTimes(1);
      expect(props.onScanQr).toHaveBeenCalledTimes(1);
    });
  });

  // QR 스캔 화면은 회사 코드만 읽고 닫힌다 (#195). 바깥(내비게이션)이 그 코드를 넘기면 이 화면이 QR 경로로 회사를 확인하고,
  // 결과는 카메라가 아니라 이 화면 위에 보인다. 찾은 회사는 역할 선택으로, 그 밖은 회사 코드 입력과 같은 안내 모달이다
  describe('QR 로 읽어 온 회사 코드 (#195)', () => {
    type JoinView = Awaited<ReturnType<typeof renderJoin>>;
    const receive = (view: JoinView, scannedCode: string | undefined) =>
      view.rerender(
        <OrgJoinScreen {...view.props} scannedCode={scannedCode} />,
      );
    const qrButton = () => screen.getByRole('button', { name: 'QR 코드 인식' });
    const INVALID_TITLE = '유효하지 않은 회사 코드입니다';
    const INVALID_MESSAGE =
      '회사에서 코드를 변경해\n이전 참여 경로를 사용할 수 없습니다.';

    it('받으면 그 코드로 회사를 확인하고, 찾은 회사를 QR 경로의 참여 대상으로 역할 선택에 넘긴다', async () => {
      const view = await renderJoin();

      await receive(view, 'RBT124');

      await waitFor(() =>
        expect(view.props.onFound).toHaveBeenCalledWith({
          ...orbit,
          companyCode: 'RBT124',
          requestChannel: 'QR_CODE',
        }),
      );
      expect(lookups(view.server)).toHaveLength(1);
      expect(lookups(view.server)[0].query).toEqual({ companyCode: 'RBT124' });
      // 읽은 코드는 입력칸에 넣지 않는다 (코드 입력 경로로 보내지 않게)
      expect(codeInput()).toHaveDisplayValue('');
    });

    it.each([
      [
        '이미 소속된 회사',
        'BS0001',
        '이미 참여 중인 회사예요',
        '오빗 서비스에 이미 소속되어 있어\n참여 요청을 다시 보낼 수 없습니다.',
      ],
      [
        '승인 대기 요청이 있는 회사',
        'HB0010',
        '이미 참여를 요청한 회사예요',
        '한빛 설비에 보낸 참여 요청이\n승인을 기다리고 있어요.',
      ],
    ])(
      '%s 면 이 화면 위에 안내 모달을 띄우고, 닫으면 회사 찾기에 머문다',
      async (_, code, title, message) => {
        const view = await renderJoin();

        await receive(view, code);

        expect(
          await screen.findByRole('header', { name: title }),
        ).toBeOnTheScreen();
        expect(screen.getByText(message)).toBeOnTheScreen();
        await userEvent.press(screen.getByRole('button', { name: '확인' }));
        expect(header(title)).toBeNull();
        expect(header('회사 찾기')).toBeOnTheScreen();
        expect(qrButton()).toBeEnabled();
        expect(view.props.onFound).not.toHaveBeenCalled();
      },
    );

    // Figma Spec_회사 참여 요청 플로우: 이전 코드·링크·QR 로 접근하면 최신 정보를 다시 확인하도록 안내(⑥ 이전 코드 차단).
    // ⑥ 은 화면이고 모달이 아니다. 회사 코드 입력처럼 제목·설명만 바뀐다
    it.each([
      ['없는 코드(ORGANIZATION-011)', 'WRNG99'],
      ['회사가 바꿔 폐기된 이전 코드(ORGANIZATION-012)', 'PRV014'],
    ])(
      '%s 면 안내 모달 없이 화면이 유효하지 않은 코드(⑥)로 바뀐다',
      async (_, code) => {
        const view = await renderJoin();

        await receive(view, code);

        expect(
          await screen.findByRole('header', { name: INVALID_TITLE }),
        ).toBeOnTheScreen();
        expect(screen.getByText(INVALID_MESSAGE)).toBeOnTheScreen();
        expect(header('회사 참여')).toBeOnTheScreen();
        expect(screen.queryByRole('button', { name: '확인' })).toBeNull();
        expect(qrButton()).toBeEnabled();
        expect(view.props.onFound).not.toHaveBeenCalled();
      },
    );

    // Figma ⑥(마이 3255:18149 · 온보딩 3257:10685)의 입력칸은 비어 있다(플레이스홀더). 앞서 친 다른 코드를 남기지 않는다.
    // 회사 코드 입력의 ⑥ 은 방금 친 코드라 그대로 둔다
    it('QR 결과가 유효하지 않은 코드(⑥)면 앞서 입력하던 코드를 비운다', async () => {
      const view = await renderJoin();
      await userEvent.type(codeInput(), 'HB00');

      await receive(view, 'PRV014');

      await screen.findByRole('header', { name: INVALID_TITLE });
      expect(codeInput()).toHaveDisplayValue('');
      expect(checkButton()).toBeDisabled();
    });

    it('QR 결과가 안내 모달이면 입력하던 코드는 그대로 둔다', async () => {
      const view = await renderJoin();
      await userEvent.type(codeInput(), 'HB00');

      await receive(view, 'BS0001');

      await screen.findByRole('header', { name: '이미 참여 중인 회사예요' });
      expect(codeInput()).toHaveDisplayValue('HB00');
    });

    // 회사 코드 입력과 같다. Android 는 바뀐 소개의 live region 이 읽는다
    it.each([
      ['ios', 1],
      ['android', 0],
    ] as const)(
      '%s: 유효하지 않은 코드면 바뀐 제목·설명을 스크린리더로 %i번 따로 알린다',
      async (os, times) => {
        jest.replaceProperty(Platform, 'OS', os);
        const announce = jest
          .spyOn(AccessibilityInfo, 'announceForAccessibility')
          .mockClear();
        const view = await renderJoin();

        await receive(view, 'PRV014');
        await screen.findByRole('header', { name: INVALID_TITLE });

        expect(announce).toHaveBeenCalledTimes(times);
        if (times > 0) {
          expect(announce).toHaveBeenCalledWith(
            `${INVALID_TITLE}. ${INVALID_MESSAGE.replace('\n', ' ')}`,
          );
        }
      },
    );

    it.each([
      [
        '실패 한도(429 ORGANIZATION-018)',
        fail(429, OrganizationErrorCode.tooManyFailures),
        '잠시 후 다시 시도해 주세요',
      ],
      ['네트워크 오류', networkError(), '회사를 확인하지 못했어요'],
    ])('%s 면 이 화면 위에 안내 모달을 띄운다', async (_, response, title) => {
      const view = await renderJoin();
      view.server.on('GET', COMPANY_LOOKUP_PATH, response);

      await receive(view, 'RBT124');

      expect(
        await screen.findByRole('header', { name: title }),
      ).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('button', { name: '확인' }));
      expect(header('회사 찾기')).toBeOnTheScreen();
      expect(view.props.onFound).not.toHaveBeenCalled();
    });

    // 사용자는 '앱으로 돌아와서' 결과를 본다. 카메라 화면이 닫히는 전환 중에 모달이 뜨거나 다음 화면이 올라오지 않게,
    // 결과(다음 화면·안내 모달·⑥)는 바깥이 알려 주는 전환 끝(waitForReturn) 뒤에 보인다. 확인 요청은 기다리지 않고 먼저 보낸다
    describe('카메라 화면이 닫히는 전환', () => {
      function renderReturning() {
        let finish: () => void = () => {};
        const waitForReturn = jest.fn(
          () =>
            new Promise<void>(done => {
              finish = done;
            }),
        );
        return renderJoin({ waitForReturn }).then(view => ({
          ...view,
          waitForReturn,
          finishReturn: () => act(async () => finish()),
        }));
      }

      it.each([
        [
          '찾은 회사면 역할 선택으로 넘기는 것',
          ok(orbitFound),
          (view: JoinView) => expect(view.props.onFound).toHaveBeenCalled(),
          (view: JoinView) => expect(view.props.onFound).not.toHaveBeenCalled(),
        ],
        [
          '없는 코드면 ⑥ 으로 바꾸는 것',
          fail(404, OrganizationErrorCode.unknownCode),
          () => expect(header(INVALID_TITLE)).toBeOnTheScreen(),
          () => expect(header(INVALID_TITLE)).toBeNull(),
        ],
        [
          '확인하지 못했으면 안내 모달을 띄우는 것',
          networkError(),
          () =>
            expect(
              screen.getByRole('header', { name: '회사를 확인하지 못했어요' }),
            ).toBeOnTheScreen(),
          () => expect(header('회사를 확인하지 못했어요')).toBeNull(),
        ],
      ])(
        '%s 은 응답이 먼저 와도 전환이 끝난 뒤에 한다',
        async (_, response, shown, notYet) => {
          const view = await renderReturning();
          const respond = holdLookup(view.server);

          await receive(view, 'RBT124');
          expect(view.waitForReturn).toHaveBeenCalledTimes(1);
          expect(lookups(view.server)).toHaveLength(1);
          await respond(response);
          await act(async () => {});
          notYet(view);
          expect(header('회사 찾기')).toBeOnTheScreen();

          await view.finishReturn();

          shown(view);
        },
      );

      it('전환이 먼저 끝났으면 응답이 오는 대로 보인다', async () => {
        const view = await renderReturning();
        const respond = holdLookup(view.server);
        await receive(view, 'RBT124');

        await view.finishReturn();
        expect(view.props.onFound).not.toHaveBeenCalled();
        await respond(ok(orbitFound));

        expect(view.props.onFound).toHaveBeenCalledTimes(1);
      });

      // 회사 코드 입력은 화면이 그대로라 기다리지 않는다
      it('회사 코드 입력은 전환을 기다리지 않는다', async () => {
        const view = await renderReturning();

        await userEvent.type(codeInput(), 'RBT124');
        await userEvent.press(checkButton());

        await waitFor(() => expect(view.props.onFound).toHaveBeenCalled());
        expect(view.waitForReturn).not.toHaveBeenCalled();
      });
    });

    // 확인 중에 읽어 온 코드는 버리지 않는다. 그 확인이 끝나면 이어서 확인한다.
    // 카메라는 이미 닫혀 돌아온 지 오래라 전환 끝을 기다리는 구독은 만들지 않는다
    it('확인하는 동안 받은 코드는 버리지 않고 그 확인이 끝난 뒤 QR 경로로 확인한다', async () => {
      const waitForReturn = jest.fn(() => new Promise<void>(() => {}));
      const view = await renderJoin({ waitForReturn });
      const respond = holdLookup(view.server);
      await userEvent.type(codeInput(), 'WRNG99');
      await userEvent.press(checkButton());

      await receive(view, 'RBT124');
      expect(waitForReturn).not.toHaveBeenCalled();
      expect(lookups(view.server)).toHaveLength(1);
      await respond(fail(404, OrganizationErrorCode.unknownCode));
      await waitFor(() => expect(lookups(view.server)).toHaveLength(2));
      await respond(ok(orbitFound));

      expect(lookups(view.server)[1].query).toEqual({ companyCode: 'RBT124' });
      await waitFor(() =>
        expect(view.props.onFound).toHaveBeenCalledWith({
          ...orbit,
          companyCode: 'RBT124',
          requestChannel: 'QR_CODE',
        }),
      );
      expect(waitForReturn).not.toHaveBeenCalled();
    });

    // 확인하는 동안 QR 을 다시 열면 그 결과가 돌아왔을 때 이미 확인 중이라 버려진다
    it('확인하는 동안 회사 확인·QR 코드 인식을 잠근다', async () => {
      const view = await renderJoin();
      const respond = holdLookup(view.server);
      await userEvent.type(codeInput(), 'HB0010');

      await receive(view, 'RBT124');

      expect(qrButton()).toBeDisabled();
      expect(checkButton()).toBeDisabled();
      await respond(ok(orbitFound));
      expect(qrButton()).toBeEnabled();
      expect(checkButton()).toBeEnabled();
      expect(lookups(view.server)).toHaveLength(1);
    });

    // 바깥은 받은 코드를 넘긴 뒤 지운다. 같은 QR 을 다시 인식해 오면 다시 확인한다
    it('지워졌다가 같은 코드를 다시 받으면 다시 확인한다. 지우는 것만으로는 확인하지 않는다', async () => {
      const view = await renderJoin();
      await receive(view, 'BS0001');
      await userEvent.press(
        await screen.findByRole('button', { name: '확인' }),
      );

      await receive(view, undefined);
      expect(lookups(view.server)).toHaveLength(1);
      await receive(view, 'BS0001');

      await waitFor(() => expect(lookups(view.server)).toHaveLength(2));
    });

    // 온보딩은 회사 코드 입력과 같이 알림 대신 그 요청의 화면으로 간다
    it('onPending·onAlreadyMember 를 주면 안내 대신 바깥에 맡긴다', async () => {
      const onPending = jest.fn();
      const onAlreadyMember = jest.fn(async () => true);
      const view = await renderJoin({
        flow: 'onboarding',
        onPending,
        onAlreadyMember,
      });

      await receive(view, 'HB0010');
      await waitFor(() =>
        expect(onPending).toHaveBeenCalledWith(
          { organizationId: '10', organizationName: '한빛 설비' },
          '1',
        ),
      );
      await receive(view, undefined);
      await receive(view, 'BS0001');
      await waitFor(() =>
        expect(onAlreadyMember).toHaveBeenCalledWith({
          organizationId: '1',
          organizationName: '오빗 서비스',
        }),
      );
      expect(header('이미 참여를 요청한 회사예요')).toBeNull();
      expect(header('이미 참여 중인 회사예요')).toBeNull();
    });
  });

  it('찾은 회사면 회사 코드·찾은 방법(코드 입력)을 담은 참여 대상으로 역할 선택에 넘긴다', async () => {
    const { props, server } = await renderJoin();

    await userEvent.type(codeInput(), 'rbt124');
    await userEvent.press(checkButton());

    await waitFor(() =>
      expect(props.onFound).toHaveBeenCalledWith({
        ...orbit,
        companyCode: 'RBT124',
        requestChannel: 'COMPANY_CODE',
      }),
    );
    expect(lookups(server)[0].query).toEqual({ companyCode: 'RBT124' });
  });

  it('없는 코드(404 ORGANIZATION-011)면 제목·설명이 바뀌고 스크린리더가 바로 읽는다. 입력은 남는다', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockClear();
    const { props } = await renderJoin();

    await userEvent.type(codeInput(), 'WRNG99');
    await userEvent.press(checkButton());

    expect(
      await screen.findByRole('header', { name: '회사 참여' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: '유효하지 않은 회사 코드입니다' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '회사에서 코드를 변경해\n이전 참여 경로를 사용할 수 없습니다.',
      ),
    ).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith(
      '유효하지 않은 회사 코드입니다. 회사에서 코드를 변경해 이전 참여 경로를 사용할 수 없습니다.',
    );
    expect(codeInput()).toHaveDisplayValue('WRNG99');
    expect(props.onFound).not.toHaveBeenCalled();
  });

  it('회사가 바꿔 폐기된 이전 코드(404 ORGANIZATION-012)도 유효하지 않은 코드다', async () => {
    await renderJoin();

    await userEvent.type(codeInput(), 'PRV014');
    await userEvent.press(checkButton());

    expect(
      await screen.findByRole('header', {
        name: '유효하지 않은 회사 코드입니다',
      }),
    ).toBeOnTheScreen();
  });

  // Android 는 live region 이 읽으므로 한 번 더 알리면 두 번 읽는다
  it('Android 는 live region 만으로 읽고 따로 알리지 않는다', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockClear();
    await renderJoin();

    await userEvent.type(codeInput(), 'WRNG99');
    await userEvent.press(checkButton());

    expect(
      await screen.findByRole('header', { name: '회사 참여' }),
    ).toBeOnTheScreen();
    expect(announce).not.toHaveBeenCalled();
  });

  // 서버는 10분 안에 없는 코드로 10번 실패하면 그 10분 동안 코드와 무관하게 막는다
  it('실패 한도(429 ORGANIZATION-018)면 잠시 후 다시 시도하라는 모달을 띄우고 입력은 남는다', async () => {
    const { server, props } = await renderJoin();
    server.on(
      'GET',
      COMPANY_LOOKUP_PATH,
      fail(429, OrganizationErrorCode.tooManyFailures),
    );

    await userEvent.type(codeInput(), 'RBT124');
    await userEvent.press(checkButton());

    expect(
      await screen.findByRole('header', {
        name: '잠시 후 다시 시도해 주세요',
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '없는 회사 코드를 여러 번 입력해\n잠시 회사를 확인할 수 없어요.',
      ),
    ).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: '확인' }));
    expect(codeInput()).toHaveDisplayValue('RBT124');
    expect(header('유효하지 않은 회사 코드입니다')).toBeNull();
    expect(props.onFound).not.toHaveBeenCalled();
  });

  it.each([
    ['네트워크 오류', networkError()],
    ['서버 오류(500)', fail(500, 'COMMON-500')],
  ])(
    '%s 면 확인하지 못했다는 모달을 띄우고, 입력은 남고 다시 확인할 수 있다',
    async (_, response) => {
      const { server, props } = await renderJoin();
      server.on('GET', COMPANY_LOOKUP_PATH, response, ok(orbitFound));

      await userEvent.type(codeInput(), 'RBT124');
      await userEvent.press(checkButton());

      expect(
        await screen.findByRole('header', { name: '회사를 확인하지 못했어요' }),
      ).toBeOnTheScreen();
      expect(screen.getByText('잠시 후 다시 시도해 주세요.')).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('button', { name: '확인' }));
      expect(codeInput()).toHaveDisplayValue('RBT124');
      expect(checkButton()).toBeEnabled();
      expect(props.onFound).not.toHaveBeenCalled();

      await userEvent.press(checkButton());
      await waitFor(() => expect(props.onFound).toHaveBeenCalledTimes(1));
    },
  );

  it('이미 소속된 회사면 모달을 띄우고, 확인을 누르면 닫히고 입력은 남는다', async () => {
    const { props } = await renderJoin();

    await userEvent.type(codeInput(), 'BS0001');
    await userEvent.press(checkButton());

    expect(
      await screen.findByRole('header', { name: '이미 참여 중인 회사예요' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '오빗 서비스에 이미 소속되어 있어\n참여 요청을 다시 보낼 수 없습니다.',
      ),
    ).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: '확인' }));

    expect(header('이미 참여 중인 회사예요')).toBeNull();
    expect(codeInput()).toHaveDisplayValue('BS0001');
    expect(props.onFound).not.toHaveBeenCalled();
  });

  it('승인 대기 중인 요청이 있는 회사면 그 사실을 알리는 모달을 띄운다', async () => {
    await renderJoin();

    await userEvent.type(codeInput(), 'HB0010');
    await userEvent.press(checkButton());

    expect(
      await screen.findByRole('header', {
        name: '이미 참여를 요청한 회사예요',
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('한빛 설비에 보낸 참여 요청이\n승인을 기다리고 있어요.'),
    ).toBeOnTheScreen();
  });

  it('확인하는 동안에는 다시 누를 수 없다', async () => {
    const { server } = await renderJoin();
    const respond = holdLookup(server);

    await userEvent.type(codeInput(), 'RBT124');
    await userEvent.press(checkButton());
    expect(checkButton()).toBeDisabled();
    await fireEvent(codeInput(), 'submitEditing');
    await respond(fail(404, OrganizationErrorCode.unknownCode));

    expect(checkButton()).toBeEnabled();
    expect(lookups(server)).toHaveLength(1);
  });

  // 회사 확인을 기다리는 동안 뒤로 가면 요청을 끊고, 늦게 온 결과로 역할 선택에 데려가지 않는다
  it('확인하는 동안 화면을 떠나면 요청을 끊고 늦은 결과로 넘기지 않는다', async () => {
    const { server, props, unmount } = await renderJoin();
    const respond = holdLookup(server);
    await userEvent.type(codeInput(), 'RBT124');
    await userEvent.press(checkButton());

    await unmount();
    await respond(ok(orbitFound));

    expect(lookups(server)[0].signal?.aborted).toBe(true);
    expect(props.onFound).not.toHaveBeenCalled();
  });

  // 다른 탭으로 옮긴 동안 결과가 오면 RN Modal 이 그 탭 위에 뜬다
  it('화면이 보이지 않는 동안 온 안내는 띄우지 않고, 돌아오면 띄운다', async () => {
    const { server, props, rerender } = await renderJoin({
      screenFocused: false,
    });
    server.on(
      'GET',
      COMPANY_LOOKUP_PATH,
      fail(429, OrganizationErrorCode.tooManyFailures),
    );

    await userEvent.type(codeInput(), 'RBT124');
    await userEvent.press(checkButton());
    await waitFor(() => expect(checkButton()).toBeEnabled());
    expect(header('잠시 후 다시 시도해 주세요')).toBeNull();

    await rerender(<OrgJoinScreen {...props} screenFocused />);

    expect(
      screen.getByRole('header', { name: '잠시 후 다시 시도해 주세요' }),
    ).toBeOnTheScreen();
  });

  // 확인 결과가 오면 갈래를 나누기 전에 제목·설명부터 맞춘다. 바깥 처리(온보딩 이미 참여 → 신청 현황 받기)를 기다리는 동안 옛 안내가 남지 않게
  it('유효하지 않은 코드 뒤 다른 코드를 확인하면, 이미 참여 처리를 기다리는 동안에도 제목이 바로 회사 찾기로 돌아온다', async () => {
    let finish: (handled: boolean) => void = () => {};
    const onAlreadyMember = jest.fn(
      () =>
        new Promise<boolean>(done => {
          finish = done;
        }),
    );
    await renderJoin({
      flow: 'onboarding',
      onPending: jest.fn(),
      onAlreadyMember,
    });
    await userEvent.type(codeInput(), 'WRNG99');
    await userEvent.press(checkButton());
    await screen.findByRole('header', {
      name: '유효하지 않은 회사 코드입니다',
    });

    await fireEvent.changeText(codeInput(), 'BS0001');
    await userEvent.press(checkButton());
    await waitFor(() => expect(onAlreadyMember).toHaveBeenCalled());

    expect(header('유효하지 않은 회사 코드입니다')).toBeNull();
    expect(header('회사 찾기')).toBeOnTheScreen();
    await act(async () => finish(true));
  });

  describe('온보딩 흐름 (#85)', () => {
    const renderOnboarding = (
      onAlreadyMember = jest.fn(async (): Promise<boolean> => true),
    ) =>
      renderJoin({ flow: 'onboarding', onPending: jest.fn(), onAlreadyMember });

    it('회사 코드 규칙은 마이와 같다 (6자일 때만 회사 확인, 허용 문자만)', async () => {
      await renderOnboarding();

      await userEvent.type(codeInput(), '12345');
      expect(checkButton()).toBeDisabled();
      await userEvent.type(codeInput(), '6-7o');
      expect(codeInput()).toHaveDisplayValue('123456');
      expect(checkButton()).toBeEnabled();
      expect(codeInput()).toHaveProp('keyboardType', 'ascii-capable');
    });

    it('머리 제목은 늘 회사 참여다', async () => {
      await renderOnboarding();

      expect(
        screen.getByRole('header', { name: '회사 참여' }),
      ).toBeOnTheScreen();
    });

    it('승인 대기 중인 회사면 알림 대신 그 요청 id 와 함께 바깥에 알린다', async () => {
      const { props } = await renderOnboarding();

      await userEvent.type(codeInput(), 'HB0010');
      await userEvent.press(checkButton());

      await waitFor(() =>
        expect(props.onPending).toHaveBeenCalledWith(
          { organizationId: '10', organizationName: '한빛 설비' },
          '1',
        ),
      );
      expect(header('이미 참여를 요청한 회사예요')).toBeNull();
    });

    it('이미 참여 중인 회사면 바깥에 먼저 맡기고, 바깥이 처리했으면 알림을 띄우지 않는다', async () => {
      const onAlreadyMember = jest.fn(async () => true);
      await renderOnboarding(onAlreadyMember);

      await userEvent.type(codeInput(), 'BS0001');
      await userEvent.press(checkButton());

      await waitFor(() =>
        expect(onAlreadyMember).toHaveBeenCalledWith({
          organizationId: '1',
          organizationName: '오빗 서비스',
        }),
      );
      expect(header('이미 참여 중인 회사예요')).toBeNull();
    });

    it('바깥이 처리하지 못했으면(그 회사의 승인 요청이 없음) 이미 참여 알림을 띄운다', async () => {
      await renderOnboarding(jest.fn(async () => false));

      await userEvent.type(codeInput(), 'BS0001');
      await userEvent.press(checkButton());

      expect(
        await screen.findByRole('header', { name: '이미 참여 중인 회사예요' }),
      ).toBeOnTheScreen();
    });
  });
});
