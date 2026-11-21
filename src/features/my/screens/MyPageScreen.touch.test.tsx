import { render, screen, within } from '@testing-library/react-native';
import {
  expectIconButtonTouchTarget,
  expectMinTouchTarget,
  minLineHeight,
  stylePt,
  type HostElement,
} from '../../../shared/testing/touchTarget';
import { myMemberships, myProfile } from '../profileTesting';
import { MyPageScreen } from './MyPageScreen';

const renderMyPage = () =>
  render(
    <MyPageScreen
      profile={{ status: 'ready', data: myProfile }}
      memberships={{ status: 'ready', data: myMemberships }}
      pendingRequestCount={3}
      reviewRequests={{ status: 'ready', data: [] }}
      onOpenReviewRequest={jest.fn()}
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

  // #199: 소속 카드의 검토 줄. 폭은 카드 폭이라 높이만 본다 (가장 작은 글자에서 이름·희망 유형 두 줄 + 위아래 눌림 여백)
  it('검토 줄은 가장 작은 글자에서도 최소 터치 영역 높이다', async () => {
    await render(
      <MyPageScreen
        profile={{ status: 'ready', data: myProfile }}
        memberships={{ status: 'ready', data: myMemberships }}
        pendingRequestCount={1}
        reviewRequests={{
          status: 'ready',
          data: [
            {
              requestId: '21',
              organizationId: '21',
              organizationName: '한빛 설비',
              desiredType: 'TECHNICIAN',
              status: 'PENDING',
              requestedAt: '2026-09-23T01:24:00Z',
            },
          ],
        }}
        onOpenReviewRequest={jest.fn()}
        onOpenNotifications={jest.fn()}
        onEditProfile={jest.fn()}
        onOpenRequestStatus={jest.fn()}
        onJoinOrganization={jest.fn()}
        onOpenNotificationSettings={jest.fn()}
        onOpenTerms={jest.fn()}
        onOpenAccount={jest.fn()}
      />,
    );

    const row = screen.getByRole('button', { name: '한빛 설비, 기사, 검토' });
    const name = within(row).getByText('한빛 설비');
    const type = within(row).getByText('기사');
    expectMinTouchTarget(row, {
      height:
        stylePt(row, 'paddingTop') +
        minLineHeight(name) +
        stylePt(name.parent as HostElement, 'gap') +
        minLineHeight(type) +
        stylePt(row, 'paddingBottom'),
    });
  });

  it.each(['알림 설정', '약관 및 앱 정보', '계정 관리'])(
    '설정 행 %s 는 행 높이를 위아래로 넓힌다',
    async name => {
      await renderMyPage();

      const row = screen.getByRole('button', { name });
      expectMinTouchTarget(row, { height: stylePt(row, 'minHeight') });
    },
  );
});
