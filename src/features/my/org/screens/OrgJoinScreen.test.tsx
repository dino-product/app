import {
  act,
  fireEvent,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';
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
  const props = { onBack: jest.fn(), onFound: jest.fn(), ...extra };
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

  // 카메라 네이티브 모듈과 권한 문구가 필요해 별도 티켓이다
  it('QR 코드 인식은 비활성이다', async () => {
    await renderJoin();

    expect(screen.getByRole('button', { name: 'QR 코드 인식' })).toBeDisabled();
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
