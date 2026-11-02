import { render, screen } from '@testing-library/react-native';
import {
  expectIconButtonTouchTarget,
  expectMinTouchTarget,
  stylePt,
} from '../../../shared/testing/touchTarget';
import { membershipsMock, profileMock } from '../mockData';
import { MyPageScreen } from './MyPageScreen';

const renderMyPage = () =>
  render(
    <MyPageScreen
      profile={profileMock}
      memberships={membershipsMock}
      pendingRequestCount={3}
      onOpenNotifications={jest.fn()}
      onEditProfile={jest.fn()}
      onOpenRequestStatus={jest.fn()}
      onJoinOrganization={jest.fn()}
      onOpenNotificationSettings={jest.fn()}
      onOpenTerms={jest.fn()}
      onOpenAccount={jest.fn()}
    />,
  );

describe('MyPageScreen 터치 영역', () => {
  it('종 버튼은 26 아이콘 그대로 최소 터치 영역으로 넓힌다', async () => {
    await renderMyPage();

    expectIconButtonTouchTarget(
      screen.getByRole('button', { name: '알림센터' }),
    );
  });

  // 폭은 글자로 정해져 높이만 본다
  it.each(['신청 현황, 3건', '조직 참여'])(
    '%s 는 30 높이를 위아래로 넓힌다',
    async name => {
      await renderMyPage();

      const button = screen.getByRole('button', { name });
      expectMinTouchTarget(button, { height: stylePt(button, 'height') });
    },
  );

  it.each(['알림 설정', '약관 및 앱 정보', '계정 관리'])(
    '설정 행 %s 는 행 높이를 위아래로 넓힌다',
    async name => {
      await renderMyPage();

      const row = screen.getByRole('button', { name });
      expectMinTouchTarget(row, { height: stylePt(row, 'minHeight') });
    },
  );
});
