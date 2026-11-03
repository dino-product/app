import { act, render, screen, userEvent } from '@testing-library/react-native';
import { NativeModules } from 'react-native';
import type { ParticipationRequest } from '../model';
import { JoinRequestedScreen } from './JoinRequestedScreen';

const request: ParticipationRequest = {
  requestId: 'request-9',
  organizationId: 'org-9',
  organizationName: 'Orbit',
  desiredType: 'TECHNICIAN',
  status: 'PENDING',
  requestChannel: 'COMPANY_CODE',
  requestedAt: new Date(2026, 8, 23, 10, 24).toISOString(),
};

// 바텀시트 애니메이션(프리셋의 네이티브 애니메이션 목)은 테스트가 끝낸다
let runningAnimations: Array<(result: { finished: boolean }) => void> = [];
const finishAnimations = () =>
  act(() => {
    runningAnimations.splice(0).forEach(end => end({ finished: true }));
  });
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

const sheetTitle = () =>
  screen.queryByRole('header', { name: 'Orbit 참여 신청을 취소할까요?' });

const renderRequested = () => {
  const props = {
    request,
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    onBack: jest.fn(),
  };
  return render(<JoinRequestedScreen {...props} />).then(() => props);
};

describe('JoinRequestedScreen', () => {
  it('요청을 보냈다는 안내와 3단계 진행 표시를 보여준다', async () => {
    await renderRequested();

    expect(
      screen.getByRole('header', { name: '참여 요청을 보냈어요' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('사무실에서 요청을 확인하면 알려드릴게요.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        '진행 단계: 요청 완료, 다음은 사무실 검토 중, 참여 완료',
      ),
    ).toBeOnTheScreen();
  });

  it('요약에 회사, 희망 유형, 요청 경로, 요청 일시가 보인다', async () => {
    await renderRequested();

    for (const [label, value] of [
      ['회사', 'Orbit'],
      ['희망 유형', '기사'],
      ['요청 경로', '회사 코드'],
      ['요청 일시', '2026-09-23 · 10:24'],
    ]) {
      expect(screen.getByLabelText(`${label}, ${value}`)).toBeOnTheScreen();
    }
    expect(
      screen.getByText('승인 전까지 회사의 일정과 작업은 표시되지 않습니다.'),
    ).toBeOnTheScreen();
  });

  it('확인을 누르면 onConfirm 을 부른다', async () => {
    const props = await renderRequested();

    await userEvent.press(screen.getByRole('button', { name: '확인' }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('신청 취소를 누르면 바텀시트가 뜨고, 시트의 취소로 이 신청을 취소한다', async () => {
    const props = await renderRequested();

    await userEvent.press(screen.getByRole('button', { name: '신청 취소' }));
    expect(sheetTitle()).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: '취소' }));
    // 시트가 다 내려간 뒤에 취소·이동한다 (모달 아래에서 화면 전환이 일어나지 않게)
    expect(props.onCancel).not.toHaveBeenCalled();
    await finishAnimations();
    expect(props.onCancel).toHaveBeenCalledWith('request-9');
    expect(sheetTitle()).toBeNull();
  });

  it('시트의 닫기는 아무것도 바꾸지 않고 닫는다', async () => {
    const props = await renderRequested();

    await userEvent.press(screen.getByRole('button', { name: '신청 취소' }));
    await userEvent.press(screen.getByRole('button', { name: '닫기' }));
    await finishAnimations();

    expect(props.onCancel).not.toHaveBeenCalled();
    expect(sheetTitle()).toBeNull();
  });
});
