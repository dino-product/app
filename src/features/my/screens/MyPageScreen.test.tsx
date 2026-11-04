import {
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors, pressedBackground } from '../../../shared/design-system';
import {
  fail,
  hang,
  networkError,
  ok,
  type FakeServer,
} from '../../../shared/testing/fakeServer';
import { expectPressedBackground } from '../../../shared/testing/pressFeedback';
import {
  createTestApi,
  renderWithApi,
} from '../../../shared/testing/renderWithApi';
import { isInsideScrollView } from '../../../shared/testing/scroll';
import { testSession } from '../../../shared/testing/session';
import { stylePt, type HostElement } from '../../../shared/testing/touchTarget';
import { MEMBERSHIPS_PATH } from '../memberships';
import {
  MY_PROFILE_PATH,
  myProfileResponse,
  myServer,
  seedMyCache,
} from '../profileTesting';
import { MyPageScreen, type MyPageScreenProps } from './MyPageScreen';

const callbacks = () => ({
  onOpenNotifications: jest.fn(),
  onEditProfile: jest.fn(),
  onOpenRequestStatus: jest.fn(),
  onJoinOrganization: jest.fn(),
  onOpenNotificationSettings: jest.fn(),
  onOpenTerms: jest.fn(),
  onOpenAccount: jest.fn(),
});

/** 가짜 서버로 연다. 기본은 프로필·소속 셋을 주는 서버 */
async function renderMyPage(
  overrides: Partial<MyPageScreenProps> = {},
  server: FakeServer = myServer(),
) {
  const props: MyPageScreenProps = {
    pendingRequestCount: 3,
    ...callbacks(),
    ...overrides,
  };
  const view = await renderWithApi(<MyPageScreen {...props} />, {
    server,
    session: testSession(),
  });
  return { ...view, props };
}

/** 프로필·소속을 다 받을 때까지 기다린다 */
async function renderLoadedMyPage(overrides: Partial<MyPageScreenProps> = {}) {
  const view = await renderMyPage(overrides);
  await screen.findByRole('button', { name: /^김현진/ });
  await screen.findByTestId('membership-1');
  return view.props;
}

const loading = () => screen.queryAllByLabelText('불러오는 중');
const retry = () => screen.getByRole('button', { name: '다시 시도' });

describe('MyPageScreen', () => {
  it('제목과 서버 프로필(이름, 010-0000-0000 연락처, 가입일)을 보여준다', async () => {
    await renderLoadedMyPage();

    expect(
      screen.getByRole('header', { name: '마이페이지' }),
    ).toBeOnTheScreen();
    const card = screen.getByRole('button', { name: /^김현진/ });
    expect(within(card).getByText('김현진')).toBeOnTheScreen();
    expect(within(card).getByText('010-1234-5678')).toBeOnTheScreen();
    expect(within(card).getByText('가입일 2024.03.15')).toBeOnTheScreen();
  });

  it('소속 발주사마다 이름, 역할, 활성/비활성 칩을 서버 순서대로 보여준다', async () => {
    await renderLoadedMyPage();

    expect(
      screen.getByRole('header', { name: '소속 발주사' }),
    ).toBeOnTheScreen();
    const rows = screen.getAllByTestId(/^membership-\d+$/);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAccessibleName('오빗 서비스, 총관리자, 활성');
    expect(rows[1]).toHaveAccessibleName('현장 파트너스, 기사, 비활성');
    expect(rows[2]).toHaveAccessibleName('테크 솔루션, 총관리자, 활성');
  });

  it('활성 칩은 초록, 비활성 칩은 회색이다', async () => {
    await renderLoadedMyPage();

    expect(screen.getByTestId('membership-1-status')).toHaveStyle({
      backgroundColor: colors.completed[2],
    });
    expect(
      within(screen.getByTestId('membership-1-status')).getByText('활성'),
    ).toHaveStyle({ color: colors.completed[1] });
    expect(screen.getByTestId('membership-2-status')).toHaveStyle({
      backgroundColor: colors.registered[2],
    });
    expect(
      within(screen.getByTestId('membership-2-status')).getByText('비활성'),
    ).toHaveStyle({ color: colors.registered[1] });
  });

  it('소속 발주사가 없으면 안내 문구를 보여준다', async () => {
    await renderMyPage({}, myServer({ memberships: [] }));

    expect(
      await screen.findByText('아직 소속된 발주사가 없어요'),
    ).toBeOnTheScreen();
    expect(screen.queryAllByTestId(/^membership-\d+$/)).toHaveLength(0);
  });

  describe('불러오기', () => {
    it('받는 동안 프로필 카드와 소속 카드 자리에 진행 표시를 보이고, 설정 행은 그대로 쓸 수 있다', async () => {
      const { props } = await renderMyPage(
        {},
        myServer()
          .on('GET', MY_PROFILE_PATH, hang())
          .on('GET', MEMBERSHIPS_PATH, hang()),
      );

      expect(loading()).toHaveLength(2);
      expect(screen.queryByRole('button', { name: /^김현진/ })).toBeNull();
      expect(screen.queryByText('아직 소속된 발주사가 없어요')).toBeNull();
      await userEvent.press(screen.getByRole('button', { name: '계정 관리' }));
      expect(props.onOpenAccount).toHaveBeenCalledTimes(1);
    });

    it('프로필을 받지 못하면 안내와 다시 시도를 보이고, 다시 시도로 받아 온다', async () => {
      const server = myServer().on(
        'GET',
        MY_PROFILE_PATH,
        fail(500, 'COMMON-500'),
        ok(myProfileResponse()),
      );
      await renderMyPage({}, server);

      expect(
        await screen.findByText('프로필을 불러오지 못했어요.'),
      ).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: /^김현진/ })).toBeNull();
      // 소속은 따로 받아 그대로 보인다
      expect(await screen.findByTestId('membership-1')).toBeOnTheScreen();

      await userEvent.press(retry());

      expect(
        await screen.findByRole('button', { name: /^김현진/ }),
      ).toBeOnTheScreen();
      expect(server.callsTo('GET', MY_PROFILE_PATH)).toHaveLength(2);
    });

    it('소속을 받지 못하면(네트워크) 안내와 다시 시도를 보이고, 다시 시도로 받아 온다', async () => {
      const server = myServer().on(
        'GET',
        MEMBERSHIPS_PATH,
        networkError(),
        ok({ memberships: [] }),
      );
      await renderMyPage({}, server);

      expect(
        await screen.findByText('소속 발주사를 불러오지 못했어요.'),
      ).toBeOnTheScreen();
      expect(
        await screen.findByRole('button', { name: /^김현진/ }),
      ).toBeOnTheScreen();

      await userEvent.press(retry());

      expect(
        await screen.findByText('아직 소속된 발주사가 없어요'),
      ).toBeOnTheScreen();
    });

    // 켤 때 가입 단계 확인(AuthProvider)이 받아 둔 프로필을 그대로 쓴다. 정하지 않은 경로는 가짜 서버가 실패로 잡는다
    it('이미 받아 둔 프로필은 다시 요청하지 않고 바로 그린다', async () => {
      const api = createTestApi({
        server: myServer().on('GET', MY_PROFILE_PATH, hang()),
        session: testSession(),
      });
      seedMyCache(api.queryClient);

      await render(<MyPageScreen pendingRequestCount={0} {...callbacks()} />, {
        wrapper: api.wrapper,
      });

      expect(screen.getByRole('button', { name: /^김현진/ })).toBeOnTheScreen();
      expect(api.server.callsTo('GET', MY_PROFILE_PATH)).toHaveLength(0);
    });

    it('가입 시각이 아직 없으면 가입일을 비운다', async () => {
      await renderMyPage(
        {},
        myServer({ profile: myProfileResponse({ signedUpAt: null }) }),
      );

      const card = await screen.findByRole('button', { name: /^김현진/ });
      expect(card).toHaveAccessibleName('김현진, 010-1234-5678');
      expect(within(card).queryByText(/^가입일/)).toBeNull();
    });
  });

  it('신청 현황 배지에 진행 중인 신청 수를 보여주고, 없으면 배지를 숨긴다', async () => {
    await renderLoadedMyPage();
    expect(
      screen.getByRole('button', { name: '신청 현황, 3건' }),
    ).toBeOnTheScreen();

    await renderLoadedMyPage({ pendingRequestCount: 0 });
    expect(screen.getByRole('button', { name: '신청 현황' })).toBeOnTheScreen();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('설정 및 정보 행 세 개를 보여준다', async () => {
    await renderLoadedMyPage();

    expect(
      screen.getByRole('header', { name: '설정 및 정보' }),
    ).toBeOnTheScreen();
    for (const name of ['알림 설정', '약관 및 앱 정보', '계정 관리']) {
      expect(screen.getByRole('button', { name })).toBeOnTheScreen();
    }
  });

  it.each([
    ['알림센터', 'onOpenNotifications'],
    ['신청 현황, 3건', 'onOpenRequestStatus'],
    ['조직 참여', 'onJoinOrganization'],
    ['알림 설정', 'onOpenNotificationSettings'],
    ['약관 및 앱 정보', 'onOpenTerms'],
    ['계정 관리', 'onOpenAccount'],
  ] as const)('%s 를 누르면 %s 가 불린다', async (name, callback) => {
    const props = await renderLoadedMyPage();

    await userEvent.press(screen.getByRole('button', { name }));

    expect(props[callback]).toHaveBeenCalledTimes(1);
  });

  it('프로필 카드를 누르면 프로필 수정으로 간다', async () => {
    const props = await renderLoadedMyPage();

    await userEvent.press(screen.getByRole('button', { name: /^김현진/ }));

    expect(props.onEditProfile).toHaveBeenCalledTimes(1);
  });

  // #103: 탭 첫 화면 공통 상단 바 (Figma 3463:17455 규격)
  it('제목과 종(상단 바)은 스크롤 뷰 밖에 고정되고, 다른 탭과 같은 규격이다', async () => {
    await renderLoadedMyPage();

    const title = screen.getByRole('header', { name: '마이페이지' });
    expect(isInsideScrollView(title)).toBe(false);
    expect(
      isInsideScrollView(screen.getByRole('button', { name: '알림센터' })),
    ).toBe(false);
    expect(title.parent?.parent).toHaveStyle({
      paddingTop: 12,
      paddingHorizontal: 24,
    });
  });

  it('프로필 카드는 상단 바 아래 20 에서 시작한다', async () => {
    await renderLoadedMyPage();

    let scroll = screen.getByRole('button', { name: /^김현진/ }).parent;
    while (scroll && scroll.type !== 'RCTScrollView') {
      scroll = scroll.parent;
    }
    expect(
      StyleSheet.flatten(scroll?.props.contentContainerStyle),
    ).toMatchObject({ paddingTop: 20 });
  });

  // #102: 누르는 동안 회색 배경 (흰 카드 안의 행은 Gray50)
  describe('눌림', () => {
    it('프로필 카드를 누르고 있는 동안 배경이 Gray50 이 되고 떼면 돌아온다', async () => {
      await renderLoadedMyPage();

      await expectPressedBackground(
        screen.getByRole('button', { name: /^김현진/ }),
        pressedBackground.onWhite,
      );
    });

    it.each(['알림 설정', '약관 및 앱 정보', '계정 관리'])(
      '설정 행 %s 를 누르고 있는 동안 배경이 Gray50 이 되고 떼면 돌아온다',
      async name => {
        await renderLoadedMyPage();

        await expectPressedBackground(
          screen.getByRole('button', { name }),
          pressedBackground.onWhite,
        );
      },
    );

    it('소속 발주사 행을 누르고 있는 동안 배경이 Gray50 이 되고 떼면 돌아온다', async () => {
      await renderLoadedMyPage();

      await expectPressedBackground(
        screen.getByTestId('membership-1'),
        pressedBackground.onWhite,
      );
    });

    it('소속 행은 눌러도 동작이 없고 스크린리더에서는 지금처럼 정보 한 줄이다', async () => {
      await renderLoadedMyPage();

      const row = screen.getByTestId('membership-1');
      expect(row).toHaveProp('accessible', true);
      expect(row).toHaveAccessibleName('오빗 서비스, 총관리자, 활성');
      expect(row).not.toHaveProp('accessibilityRole', 'button');
      expect(
        screen.queryByRole('button', { name: /^오빗 서비스/ }),
      ).not.toBeOnTheScreen();
      // Pressable 은 기본으로 Android 에서 클릭할 수 있는 뷰가 되어 TalkBack 이 '두 번 탭하여 활성화' 를 읽는다
      expect(row).toHaveProp('focusable', false);
    });

    // 회색은 카드 안쪽에 둥근 사각형으로 칠한다. 여백 일부를 행 안으로 옮겨 글자 자리는 그대로다
    it('소속 행·설정 행의 글자는 지금처럼 카드 안 20 에서 시작하고, 소속 행 사이는 13·선·13 이다', async () => {
      await renderLoadedMyPage();

      const membership = screen.getByTestId('membership-1');
      const membershipCard = membership.parent as HostElement;
      expect(
        stylePt(membershipCard, 'paddingHorizontal') +
          stylePt(membership, 'paddingHorizontal'),
      ).toBe(20);
      expect(
        stylePt(membershipCard, 'paddingVertical') +
          stylePt(membership, 'paddingVertical'),
      ).toBe(20);
      const divider = membershipCard.children[1] as HostElement;
      expect(divider).toHaveStyle({ height: 1 });
      expect(
        stylePt(membershipCard, 'paddingHorizontal') +
          stylePt(divider, 'marginHorizontal'),
      ).toBe(20);
      expect(stylePt(divider, 'marginVertical')).toBe(0);
      expect(stylePt(membership, 'paddingVertical')).toBe(13);

      const setting = screen.getByRole('button', { name: '알림 설정' });
      const settingsCard = setting.parent as HostElement;
      expect(
        stylePt(settingsCard, 'paddingHorizontal') +
          stylePt(setting, 'paddingHorizontal'),
      ).toBe(20);
    });

    // 카드 모서리(16)에서 안쪽 여백만큼 줄인 모서리라 회색이 카드의 둥근 모서리 밖으로 나가지 않는다
    it('소속 행·설정 행의 회색은 카드 모서리와 같은 중심의 둥근 사각형이다', async () => {
      await renderLoadedMyPage();

      for (const row of [
        screen.getByTestId('membership-1'),
        screen.getByRole('button', { name: '알림 설정' }),
      ]) {
        const card = row.parent as HostElement;
        expect(
          stylePt(row, 'borderRadius') + stylePt(card, 'paddingHorizontal'),
        ).toBe(stylePt(card, 'borderRadius'));
        expect(stylePt(card, 'paddingVertical')).toBeLessThanOrEqual(
          stylePt(card, 'paddingHorizontal'),
        );
      }
    });
  });

  it('소속 행은 누르는 동작이 없는 정보 행이다', async () => {
    await renderLoadedMyPage();

    expect(screen.getByTestId('membership-1')).not.toHaveProp(
      'accessibilityRole',
      'button',
    );
  });
});
