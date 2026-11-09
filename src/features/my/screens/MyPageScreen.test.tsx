import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors, pressedBackground } from '../../../shared/design-system';
import { iconSvgs } from '../../../shared/design-system/icons/svgs';
import {
  fail,
  hang,
  networkError,
  ok,
  type FakeResponse,
  type FakeServer,
} from '../../../shared/testing/fakeServer';
import { pressIn, pressOut } from '../../../shared/testing/press';
import { expectPressedBackground } from '../../../shared/testing/pressFeedback';
import { boxOf, expectOnlySkeletons } from '../../../shared/testing/skeleton';
import {
  createTestApi,
  renderWithApi,
} from '../../../shared/testing/renderWithApi';
import { TAB_HEADER_HEIGHT } from '../../../shared/layout/TabHeader';
import { holdNativeAnimations } from '../../../../jest/nativeAnimation';
import {
  autoHideHeader,
  autoHideHeaderOffset,
  scrollDownFromTop,
  scrollListTo,
} from '../../../shared/testing/autoHideHeader';
import { isInsideScrollView } from '../../../shared/testing/scroll';
import { testSession } from '../../../shared/testing/session';
import { stylePt, type HostElement } from '../../../shared/testing/touchTarget';
import { MEMBERSHIPS_PATH } from '../memberships';
import { useMyMemberships, useMyProfile } from '../myQueries';
import {
  MY_PROFILE_PATH,
  myMemberships,
  myProfile,
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

/** 받아 둔 프로필(김현진)·소속(발주사 셋)으로 그린다 */
async function renderLoadedMyPage(overrides: Partial<MyPageScreenProps> = {}) {
  const props: MyPageScreenProps = {
    profile: { status: 'ready', data: myProfile },
    memberships: { status: 'ready', data: myMemberships },
    pendingRequestCount: 3,
    ...callbacks(),
    ...overrides,
  };
  await render(<MyPageScreen {...props} />);
  return props;
}

type ScreenCallbacks = Omit<MyPageScreenProps, 'profile' | 'memberships'>;

// 경로처럼 조회 훅(useMyProfile·useMyMemberships)의 결과를 화면에 넘긴다
function ConnectedMyPage(props: ScreenCallbacks) {
  const profile = useMyProfile();
  const memberships = useMyMemberships();
  return (
    <MyPageScreen {...props} profile={profile} memberships={memberships} />
  );
}

/** 가짜 서버로 받아 그린다. 기본은 프로필·소속 셋을 주는 서버 */
async function renderMyPage(server: FakeServer = myServer()) {
  const props: ScreenCallbacks = { pendingRequestCount: 3, ...callbacks() };
  const view = await renderWithApi(<ConnectedMyPage {...props} />, {
    server,
    session: testSession(),
  });
  return { ...view, props };
}

const retry = () => screen.getByRole('button', { name: '다시 시도' });

describe('MyPageScreen', () => {
  it('제목과 프로필(이름, 010-0000-0000 연락처, 가입일)을 보여준다', async () => {
    await renderLoadedMyPage();

    expect(
      screen.getByRole('header', { name: '마이페이지' }),
    ).toBeOnTheScreen();
    const card = screen.getByRole('button', { name: /^김현진/ });
    expect(within(card).getByText('김현진')).toBeOnTheScreen();
    expect(within(card).getByText('010-1234-5678')).toBeOnTheScreen();
    expect(within(card).getByText('가입일 2024.03.15')).toBeOnTheScreen();
  });

  it('소속 발주사마다 이름, 역할, 활성/비활성 칩을 받은 순서대로 보여준다', async () => {
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
    await renderLoadedMyPage({ memberships: { status: 'ready', data: [] } });

    expect(screen.getByText('아직 소속된 발주사가 없어요')).toBeOnTheScreen();
    expect(screen.queryAllByTestId(/^membership-\d+$/)).toHaveLength(0);
  });

  it('가입 시각이 아직 없으면 가입일을 비운다', async () => {
    await renderLoadedMyPage({
      profile: { status: 'ready', data: { ...myProfile, signedUpAt: null } },
    });

    const card = screen.getByRole('button', { name: /^김현진/ });
    expect(card).toHaveAccessibleName('김현진, 010-1234-5678');
    expect(within(card).queryByText(/^가입일/)).toBeNull();
  });

  describe('서버 연동 (GET /profiles/{accountId}, GET /memberships)', () => {
    it('서버 프로필과 소속 발주사를 보여준다', async () => {
      await renderMyPage();

      expect(
        await screen.findByRole('button', { name: /^김현진/ }),
      ).toHaveAccessibleName('김현진, 010-1234-5678, 가입일 2024.03.15');
      expect(await screen.findAllByTestId(/^membership-\d+$/)).toHaveLength(3);
    });

    it('소속이 없으면 지금의 빈 상태다', async () => {
      await renderMyPage(myServer({ memberships: [] }));

      expect(
        await screen.findByText('아직 소속된 발주사가 없어요'),
      ).toBeOnTheScreen();
    });

    it('받는 동안 프로필 카드와 소속 카드 자리에 그 모양의 스켈레톤을 보이고(스피너 없음), 설정 행은 그대로 쓸 수 있다', async () => {
      let answer: (response: FakeResponse) => void = () => {};
      const { props } = await renderMyPage(
        myServer()
          .on(
            'GET',
            MY_PROFILE_PATH,
            () =>
              new Promise<FakeResponse>(resolve => {
                answer = resolve;
              }),
          )
          .on('GET', MEMBERSHIPS_PATH, hang()),
      );

      expectOnlySkeletons('profile-card-skeleton', 'memberships-skeleton');
      expect(screen.queryByRole('button', { name: /^김현진/ })).toBeNull();
      expect(screen.queryByText('아직 소속된 발주사가 없어요')).toBeNull();
      await userEvent.press(screen.getByRole('button', { name: '계정 관리' }));
      expect(props.onOpenAccount).toHaveBeenCalledTimes(1);
      // 프로필 요청은 화면을 떠나도 끊지 않으므로 답해 끝낸다
      await act(async () => answer(ok(myProfileResponse())));
    });

    it('프로필을 받지 못하면 안내와 다시 시도를 보이고, 다시 시도로 받아 온다', async () => {
      const server = myServer().on(
        'GET',
        MY_PROFILE_PATH,
        fail(500, 'COMMON-500'),
        ok(myProfileResponse()),
      );
      await renderMyPage(server);

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
      await renderMyPage(server);

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

      await render(
        <ConnectedMyPage pendingRequestCount={0} {...callbacks()} />,
        { wrapper: api.wrapper },
      );

      expect(screen.getByRole('button', { name: /^김현진/ })).toBeOnTheScreen();
      expect(api.server.callsTo('GET', MY_PROFILE_PATH)).toHaveLength(0);
    });

    it('받아 둔 프로필이 있으면 뒤에서 다시 받는 동안에도 스켈레톤을 다시 보이지 않는다 (#139)', async () => {
      const api = createTestApi({
        server: myServer().on('GET', MY_PROFILE_PATH, hang()),
        session: testSession(),
      });
      seedMyCache(api.queryClient);
      await render(
        <ConnectedMyPage pendingRequestCount={0} {...callbacks()} />,
        { wrapper: api.wrapper },
      );

      // 프로필 응답은 오지 않는다. 다시 받기가 끝나기를 기다리지 않고 받는 동안의 화면을 본다
      await act(async () => {
        api.queryClient.invalidateQueries();
      });

      await waitFor(() =>
        expect(api.server.callsTo('GET', MY_PROFILE_PATH)).toHaveLength(1),
      );
      expect(screen.getByRole('button', { name: /^김현진/ })).toBeOnTheScreen();
      expect(screen.queryByLabelText('불러오는 중')).not.toBeOnTheScreen();
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

  // #141: Figma 마이페이지 3235:17104 › 설정 및 정보 카드 3235:17171 (아이콘 20, #585858, 아이콘–글자 10)
  describe('설정 및 정보 행 아이콘 (Figma)', () => {
    const svgIn = (row: HostElement) => {
      const [iconView] = row.children;
      const [svg] =
        iconView === undefined || typeof iconView === 'string'
          ? []
          : iconView.children;
      if (svg === undefined || typeof svg === 'string') {
        throw new Error('아이콘 SVG 가 없습니다');
      }
      return svg;
    };

    it.each([
      // Web Icon 종 (3235:17173)
      ['알림 설정', 'settings-bell', 'd="M5.5 8C5.5 6.67392'],
      // famicons:document-text-outline (3235:17179) — 글줄 두 개
      [
        '약관 및 앱 정보',
        'settings-document',
        'M7.75 11.7504H13.25M7.75 14.5004H13.25',
      ],
      // ci:user-03 (3235:17185)
      ['계정 관리', 'settings-user', 'd="M15 15.8333C15 13.9917'],
    ] as const)(
      '%s 행은 Figma 에서 내보낸 %s 아이콘을 20 · Gray700 으로 그린다',
      async (name, icon, path) => {
        await renderLoadedMyPage();

        const svg = svgIn(screen.getByRole('button', { name }));
        expect(svg.props.xml).toContain(path);
        expect(svg.props.xml).toBe(iconSvgs[icon].xml);
        expect(svg.props).toMatchObject({
          width: 20,
          height: 20,
          color: colors.gray[700],
        });
      },
    );

    it('설정 행의 아이콘과 글자 사이는 10 이다', async () => {
      await renderLoadedMyPage();

      for (const name of ['알림 설정', '약관 및 앱 정보', '계정 관리']) {
        expect(screen.getByRole('button', { name })).toHaveStyle({ gap: 10 });
      }
    });
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

  // #148: 상단 바는 스크롤 뷰 위에 겹쳐 그리므로 내용 위 여백에 상단 바 높이를 더한다
  it('프로필 카드는 상단 바 아래 20 에서 시작한다', async () => {
    await renderLoadedMyPage();

    let scroll = screen.getByRole('button', { name: /^김현진/ }).parent;
    while (scroll && scroll.type !== 'RCTScrollView') {
      scroll = scroll.parent;
    }
    expect(
      StyleSheet.flatten(scroll?.props.contentContainerStyle),
    ).toMatchObject({ paddingTop: TAB_HEADER_HEIGHT + 20 });
  });

  // #148: 아래로 스크롤하면 상단 바가 숨고, 위로 스크롤을 시작하면 다시 보인다 (공용 AutoHideHeaderLayout)
  describe('상단 바 자동 숨김', () => {
    let finishAnimations: () => Promise<void>;
    beforeEach(() => {
      finishAnimations = holdNativeAnimations().finish;
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('제목과 종은 스크롤 뷰 위에 겹쳐 그린 머리 안에 있다', async () => {
      await renderLoadedMyPage();

      expect(
        within(autoHideHeader()).getByRole('header', { name: '마이페이지' }),
      ).toBeOnTheScreen();
      expect(
        within(autoHideHeader()).getByRole('button', { name: '알림센터' }),
      ).toBeOnTheScreen();
    });

    it('아래로 스크롤하면 상단 바가 숨고, 위로 스크롤을 시작하면 다시 보이며 종을 누를 수 있다', async () => {
      const props = await renderLoadedMyPage();
      const scroll = screen.getByTestId('my-page-scroll');

      await scrollDownFromTop(scroll);
      await finishAnimations();
      expect(autoHideHeaderOffset()).toBe(-TAB_HEADER_HEIGHT);

      await scrollListTo(scroll, 280);
      await finishAnimations();
      expect(autoHideHeaderOffset()).toBe(0);
      await userEvent.press(screen.getByRole('button', { name: '알림센터' }));
      expect(props.onOpenNotifications).toHaveBeenCalledTimes(1);
    });

    // 새로고침이 없는 화면이라 위아래 바운스도 없다 (#103 noOverscroll)
    it('바운스 없이 스크롤한다', async () => {
      await renderLoadedMyPage();

      expect(screen.getByTestId('my-page-scroll')).toHaveProp('bounces', false);
    });
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

    // 회색은 카드 안쪽에 둥근 사각형으로 칠한다. 여백 일부를 행 안으로 옮겨 글자 자리는 그대로다
    it('설정 행의 글자는 지금처럼 카드 안 20 에서 시작한다', async () => {
      await renderLoadedMyPage();

      const setting = screen.getByRole('button', { name: '알림 설정' });
      const settingsCard = setting.parent as HostElement;
      expect(
        stylePt(settingsCard, 'paddingHorizontal') +
          stylePt(setting, 'paddingHorizontal'),
      ).toBe(20);
    });

    // 카드 모서리(16)에서 안쪽 여백만큼 줄인 모서리라 회색이 카드의 둥근 모서리 밖으로 나가지 않는다
    it('설정 행의 회색은 카드 모서리와 같은 중심의 둥근 사각형이다', async () => {
      await renderLoadedMyPage();

      const row = screen.getByRole('button', { name: '알림 설정' });
      const card = row.parent as HostElement;
      expect(
        stylePt(row, 'borderRadius') + stylePt(card, 'paddingHorizontal'),
      ).toBe(stylePt(card, 'borderRadius'));
      expect(stylePt(card, 'paddingVertical')).toBeLessThanOrEqual(
        stylePt(card, 'paddingHorizontal'),
      );
    });
  });

  // #182: 소속 발주사의 회사 줄은 누르는 기능이 없다. 누를 수 있는 것처럼 보이는 표시(눌림 회색·화살표·버튼 역할)를 두지 않는다
  describe('소속 발주사 회사 줄 (누를 수 없음)', () => {
    const rows = () => screen.getAllByTestId(/^membership-\d+$/);
    const descendants = (element: HostElement): HostElement[] =>
      element.children.flatMap(child =>
        typeof child === 'string' ? [] : [child, ...descendants(child)],
      );

    it('회사 줄은 터치를 받지 않아 손가락을 대도 배경이 바뀌지 않는다', async () => {
      await renderLoadedMyPage();

      for (const row of rows()) {
        // Pressable·Touchable 처럼 터치 응답자·클릭 뷰가 되지 않는다
        expect(row).not.toHaveProp('onStartShouldSetResponder');
        expect(row).not.toHaveProp('onResponderGrant');
        expect(row).not.toHaveProp('onClick');
      }
      const row = screen.getByTestId('membership-1');
      const idle = StyleSheet.flatten(row.props.style);
      await pressIn(row);
      expect(StyleSheet.flatten(row.props.style)).toEqual(idle);
      expect(row).not.toHaveStyle({
        backgroundColor: pressedBackground.onWhite,
      });
      await pressOut(row);
    });

    it('회사 줄에는 화살표 같은 아이콘이 없다', async () => {
      await renderLoadedMyPage();

      for (const row of rows()) {
        expect(
          descendants(row).filter(element => element.props.xml !== undefined),
        ).toEqual([]);
      }
    });

    it('스크린리더는 버튼이 아닌 정보 한 줄(이름, 역할, 상태)로 읽는다', async () => {
      await renderLoadedMyPage();

      const row = screen.getByTestId('membership-1');
      expect(row).toHaveProp('accessible', true);
      expect(row).toHaveAccessibleName('오빗 서비스, 총관리자, 활성');
      expect(row).not.toHaveProp('accessibilityRole');
      expect(row).not.toHaveProp('role');
      expect(
        screen.queryByRole('button', {
          name: /오빗 서비스|현장 파트너스|테크 솔루션/,
        }),
      ).not.toBeOnTheScreen();
    });

    // Figma 마이페이지 3235:17104 › 소속 카드 3235:17146: 안 여백 20, 행 위·아래 여백 12 와 행 아래 선(Gray50 1)
    // 선은 행 높이(57 = 글자 45 + 12)에 들어가지 않고 아래 여백 12 의 끝 1 에 그려진다 → 글자–선 11, 선–다음 글자 12
    it('카드 안 여백은 20 이고, 행 사이는 글자–선 11 · 선 1(Gray50) · 선–글자 12 다 (Figma)', async () => {
      await renderLoadedMyPage();

      const row = screen.getByTestId('membership-1');
      const card = row.parent as HostElement;
      expect(stylePt(card, 'paddingHorizontal')).toBe(20);
      expect(stylePt(card, 'paddingVertical')).toBe(20);
      for (const member of rows()) {
        expect(stylePt(member, 'padding')).toBe(0);
        expect(stylePt(member, 'paddingHorizontal')).toBe(0);
        expect(stylePt(member, 'paddingVertical')).toBe(0);
      }
      const dividers = card.children.filter(
        (child, index) => index % 2 === 1,
      ) as HostElement[];
      expect(dividers).toHaveLength(2);
      for (const divider of dividers) {
        expect(divider).toHaveStyle({
          height: 1,
          marginTop: 11,
          marginBottom: 12,
          backgroundColor: colors.gray[50],
        });
        expect(stylePt(divider, 'marginHorizontal')).toBe(0);
      }
    });

    // Figma 3235:17148: 이름 Body/XS/SemiBold Gray800(#222) · 역할 Caption/M/Medium Gray500(#7F7F7F) 사이 2
    it('이름과 역할 사이는 2 이고, 역할 글자는 Figma Gray500(#7F7F7F) 이다', async () => {
      await renderLoadedMyPage();

      const row = screen.getByTestId('membership-1');
      const name = within(row).getByText('오빗 서비스');
      expect(name.parent).toHaveStyle({ gap: 2 });
      expect(name).toHaveStyle({ fontSize: 16, color: colors.gray[900] });
      expect(within(row).getByText('총관리자')).toHaveStyle({
        fontSize: 14,
        color: colors.libraryGray[500],
      });
    });

    // 받은 내용으로 바뀔 때 높이가 튀지 않게 스켈레톤도 실제 행·선과 같은 상자다 (#139)
    it('받는 동안의 스켈레톤 행·선은 실제 회사 줄·선과 같은 상자다', async () => {
      await renderLoadedMyPage();
      const realCard = screen.getByTestId('membership-1').parent as HostElement;
      const realRow = realCard.children[0] as HostElement;
      const realDivider = realCard.children[1] as HostElement;
      const real = {
        row: boxOf(realRow),
        divider: StyleSheet.flatten(realDivider.props.style),
      };

      await renderLoadedMyPage({ memberships: { status: 'loading' } });

      const skeleton = screen.getByTestId('memberships-skeleton');
      expect(boxOf(skeleton)).toEqual({});
      expect(boxOf(skeleton.children[0] as HostElement)).toEqual(real.row);
      expect(
        StyleSheet.flatten((skeleton.children[1] as HostElement).props.style),
      ).toEqual(real.divider);
    });
  });
});
