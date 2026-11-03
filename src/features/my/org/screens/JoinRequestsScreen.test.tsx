import { act, render, screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo, NativeModules } from 'react-native';
import type { ParticipationRequest } from '../model';
import { JoinRequestsScreen } from './JoinRequestsScreen';

// 바텀시트 애니메이션(프리셋의 네이티브 애니메이션 목)은 테스트가 끝낸다
let runningAnimations: Array<(result: { finished: boolean }) => void> = [];
const finishAnimations = () =>
  act(() => {
    runningAnimations.splice(0).forEach(end => end({ finished: true }));
  });

const request = (
  requestId: string,
  organizationName: string,
): ParticipationRequest => ({
  requestId,
  organizationId: `org-${requestId}`,
  organizationName,
  desiredType: 'TECHNICIAN',
  status: 'PENDING',
  requestChannel: 'COMPANY_CODE',
  requestedAt: new Date(2026, 8, 23, 10, 24).toISOString(),
});

const two = [request('a', '한빛 설비'), request('b', '그린 테크')];

const renderRequests = (
  requests: readonly ParticipationRequest[],
  overrides: { onCancel?: jest.Mock; onJoin?: jest.Mock } = {},
) =>
  render(
    <JoinRequestsScreen
      requests={requests}
      onCancel={overrides.onCancel ?? jest.fn()}
      onJoin={overrides.onJoin ?? jest.fn()}
      onBack={jest.fn()}
    />,
  );

const sheetTitle = (name: string) =>
  screen.queryByRole('header', { name: `${name} 참여 신청을 취소할까요?` });

describe('JoinRequestsScreen', () => {
  beforeEach(() => {
    runningAnimations = [];
    jest
      .spyOn(NativeModules.NativeAnimatedModule, 'startAnimatingNode')
      .mockImplementation((...args: unknown[]) => {
        runningAnimations.push(
          args[3] as (result: { finished: boolean }) => void,
        );
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('신청이 없으면 빈 상태와 조직 참여하기를 보여준다', async () => {
    const onJoin = jest.fn();
    await renderRequests([], { onJoin });

    expect(
      screen.getByRole('header', { name: '참여 신청 현황' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('참여 신청 내역이 없어요')).toBeOnTheScreen();
    expect(
      screen.getByText(
        '회사 코드나 참여 링크·QR로 조직에 참여를\n신청해 보세요.',
      ),
    ).toBeOnTheScreen();
    await userEvent.press(
      screen.getByRole('button', { name: '조직 참여하기' }),
    );
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it('신청이 있으면 승인 대기 n 과 카드 목록을 보여준다', async () => {
    await renderRequests(two);

    expect(
      screen.getByRole('header', { name: '승인 대기 2' }),
    ).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^join-request-/)).toHaveLength(2);
    expect(screen.getAllByText('승인 대기')).toHaveLength(2);
    expect(
      screen.getAllByText('희망 유형 기사 · 2026-09-23 신청'),
    ).toHaveLength(2);
    expect(screen.getAllByText('사무실에서 검토 중이에요')).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: '조직 참여하기' }),
    ).toBeOnTheScreen();
  });

  it('카드의 신청 취소를 누르면 그 회사 이름의 바텀시트가 뜬다', async () => {
    await renderRequests(two);

    await userEvent.press(
      screen.getByRole('button', { name: '그린 테크 신청 취소' }),
    );

    expect(sheetTitle('그린 테크')).toBeOnTheScreen();
    expect(
      screen.getByText(
        '취소하면 사무실의 승인 대기 목록에서도 사라져요.\n같은 회사 코드로 언제든 다시 신청할 수 있어요.',
      ),
    ).toBeOnTheScreen();
  });

  it('시트의 취소를 누르면 그 신청을 취소하고 시트를 닫는다', async () => {
    const onCancel = jest.fn();
    await renderRequests(two, { onCancel });

    await userEvent.press(
      screen.getByRole('button', { name: '그린 테크 신청 취소' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '취소' }));
    await finishAnimations();

    expect(onCancel).toHaveBeenCalledWith('b');
    expect(sheetTitle('그린 테크')).toBeNull();
  });

  // 취소한 카드가 사라져 스크린리더가 돌아갈 곳을 잃지 않게 목록 제목으로 옮기고 알린다
  it('취소하고 시트가 내려가면 알리고 포커스를 목록 제목으로 옮긴다', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockClear();
    const focus = jest
      .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      .mockClear();
    await renderRequests(two);

    await userEvent.press(
      screen.getByRole('button', { name: '그린 테크 신청 취소' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '취소' }));
    expect(announce).not.toHaveBeenCalled();
    await finishAnimations();

    expect(announce).toHaveBeenCalledWith('그린 테크 참여 신청을 취소했어요');
    expect(focus).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({ accessibilityRole: 'header' }),
      }),
      'focus',
    );
  });

  it('닫기만 하면 알리지 않는다', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockClear();
    await renderRequests(two);

    await userEvent.press(
      screen.getByRole('button', { name: '한빛 설비 신청 취소' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '닫기' }));
    await finishAnimations();

    expect(announce).not.toHaveBeenCalled();
  });

  it('배경을 눌러 닫으면 아무것도 바꾸지 않는다', async () => {
    const onCancel = jest.fn();
    await renderRequests(two, { onCancel });

    await userEvent.press(
      screen.getByRole('button', { name: '한빛 설비 신청 취소' }),
    );
    await userEvent.press(
      screen.getByTestId('cancel-request-sheet-backdrop', {
        includeHiddenElements: true,
      }),
    );
    await finishAnimations();

    expect(onCancel).not.toHaveBeenCalled();
    expect(sheetTitle('한빛 설비')).toBeNull();
  });

  it('시트의 닫기를 누르면 아무것도 바꾸지 않고 닫는다', async () => {
    const onCancel = jest.fn();
    await renderRequests(two, { onCancel });

    await userEvent.press(
      screen.getByRole('button', { name: '한빛 설비 신청 취소' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '닫기' }));
    await finishAnimations();

    expect(onCancel).not.toHaveBeenCalled();
    expect(sheetTitle('한빛 설비')).toBeNull();
  });
});
