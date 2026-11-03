import {
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { colors } from '../../../shared/design-system';
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

  it('소속 행은 누르는 동작이 없는 정보 행이다', async () => {
    await renderMyPage();

    expect(screen.getByTestId('membership-org-1')).not.toHaveProp(
      'accessibilityRole',
      'button',
    );
  });
});
