import {
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors, pressedBackground } from '../../../shared/design-system';
import { expectPressedBackground } from '../../../shared/testing/pressFeedback';
import { isInsideScrollView } from '../../../shared/testing/scroll';
import { stylePt, type HostElement } from '../../../shared/testing/touchTarget';
import { membershipsMock, profileMock } from '../mockData';
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

const renderMyPage = (overrides: Partial<MyPageScreenProps> = {}) => {
  const props: MyPageScreenProps = {
    profile: profileMock,
    memberships: membershipsMock,
    pendingRequestCount: 3,
    ...callbacks(),
    ...overrides,
  };
  return render(<MyPageScreen {...props} />).then(() => props);
};

describe('MyPageScreen', () => {
  it('제목과 프로필(이름, 연락처, 가입일)을 보여준다', async () => {
    await renderMyPage();

    expect(
      screen.getByRole('header', { name: '마이페이지' }),
    ).toBeOnTheScreen();
    const card = screen.getByRole('button', { name: /^김현진/ });
    expect(within(card).getByText('김현진')).toBeOnTheScreen();
    expect(within(card).getByText('010-1234-5678')).toBeOnTheScreen();
    expect(within(card).getByText('가입일 2024.03.15')).toBeOnTheScreen();
  });

  it('소속 발주사마다 이름, 역할, 활성/비활성 칩을 보여준다', async () => {
    await renderMyPage();

    expect(
      screen.getByRole('header', { name: '소속 발주사' }),
    ).toBeOnTheScreen();
    const rows = screen.getAllByTestId(/^membership-org-\d+$/);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAccessibleName('오빗 서비스, 총관리자, 활성');
    expect(rows[1]).toHaveAccessibleName('현장 파트너스, 기사, 비활성');
    expect(rows[2]).toHaveAccessibleName('테크 솔루션, 총관리자, 활성');
  });

  it('활성 칩은 초록, 비활성 칩은 회색이다', async () => {
    await renderMyPage();

    expect(screen.getByTestId('membership-org-1-status')).toHaveStyle({
      backgroundColor: colors.completed[2],
    });
    expect(
      within(screen.getByTestId('membership-org-1-status')).getByText('활성'),
    ).toHaveStyle({ color: colors.completed[1] });
    expect(screen.getByTestId('membership-org-2-status')).toHaveStyle({
      backgroundColor: colors.registered[2],
    });
    expect(
      within(screen.getByTestId('membership-org-2-status')).getByText('비활성'),
    ).toHaveStyle({ color: colors.registered[1] });
  });

  it('소속 발주사가 없으면 안내 문구를 보여준다', async () => {
    await renderMyPage({ memberships: [] });

    expect(screen.getByText('아직 소속된 발주사가 없어요')).toBeOnTheScreen();
    expect(screen.queryAllByTestId(/^membership-org-\d+$/)).toHaveLength(0);
  });

  it('신청 현황 배지에 진행 중인 신청 수를 보여주고, 없으면 배지를 숨긴다', async () => {
    await renderMyPage();
    expect(
      screen.getByRole('button', { name: '신청 현황, 3건' }),
    ).toBeOnTheScreen();

    await renderMyPage({ pendingRequestCount: 0 });
    expect(screen.getByRole('button', { name: '신청 현황' })).toBeOnTheScreen();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('설정 및 정보 행 세 개를 보여준다', async () => {
    await renderMyPage();

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
    const props = await renderMyPage();

    await userEvent.press(screen.getByRole('button', { name }));

    expect(props[callback]).toHaveBeenCalledTimes(1);
  });

  it('프로필 카드를 누르면 프로필 수정으로 간다', async () => {
    const props = await renderMyPage();

    await userEvent.press(screen.getByRole('button', { name: /^김현진/ }));

    expect(props.onEditProfile).toHaveBeenCalledTimes(1);
  });

  // #103: 탭 첫 화면 공통 상단 바 (Figma 3463:17455 규격)
  it('제목과 종(상단 바)은 스크롤 뷰 밖에 고정되고, 다른 탭과 같은 규격이다', async () => {
    await renderMyPage();

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
    await renderMyPage();

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
      await renderMyPage();

      await expectPressedBackground(
        screen.getByRole('button', { name: /^김현진/ }),
        pressedBackground.onWhite,
      );
    });

    it.each(['알림 설정', '약관 및 앱 정보', '계정 관리'])(
      '설정 행 %s 를 누르고 있는 동안 배경이 Gray50 이 되고 떼면 돌아온다',
      async name => {
        await renderMyPage();

        await expectPressedBackground(
          screen.getByRole('button', { name }),
          pressedBackground.onWhite,
        );
      },
    );

    it('소속 발주사 행을 누르고 있는 동안 배경이 Gray50 이 되고 떼면 돌아온다', async () => {
      await renderMyPage();

      await expectPressedBackground(
        screen.getByTestId('membership-org-1'),
        pressedBackground.onWhite,
      );
    });

    it('소속 행은 눌러도 동작이 없고 스크린리더에서는 지금처럼 정보 한 줄이다', async () => {
      await renderMyPage();

      const row = screen.getByTestId('membership-org-1');
      expect(row).toHaveProp('accessible', true);
      expect(row).toHaveAccessibleName('오빗 서비스, 총관리자, 활성');
      expect(row).not.toHaveProp('accessibilityRole', 'button');
      expect(
        screen.queryByRole('button', { name: /^오빗 서비스/ }),
      ).not.toBeOnTheScreen();
    });

    // 회색은 카드 안쪽에 둥근 사각형으로 칠한다. 여백 일부를 행 안으로 옮겨 글자 자리는 그대로다
    it('소속 행·설정 행의 글자는 지금처럼 카드 안 20 에서 시작하고, 소속 행 사이는 13·선·13 이다', async () => {
      await renderMyPage();

      const membership = screen.getByTestId('membership-org-1');
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
      await renderMyPage();

      for (const row of [
        screen.getByTestId('membership-org-1'),
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
    await renderMyPage();

    expect(screen.getByTestId('membership-org-1')).not.toHaveProp(
      'accessibilityRole',
      'button',
    );
  });
});
