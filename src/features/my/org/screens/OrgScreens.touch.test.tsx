import { screen, userEvent } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { smallestLineHeight } from '../../../../shared/design-system/tokens/touchTarget';
import { networkError } from '../../../../shared/testing/fakeServer';
import { renderWithApi } from '../../../../shared/testing/renderWithApi';
import { testSession } from '../../../../shared/testing/session';
import {
  expectIconButtonTouchTarget,
  expectMinTouchTarget,
  stylePt,
} from '../../../../shared/testing/touchTarget';
import { PARTICIPATION_REQUESTS_PATH } from '../participationApi';
import { createParticipationServer, EXISTING_REQUESTS } from '../testing';
import { JoinRequestedScreen } from './JoinRequestedScreen';
import { JoinRequestsScreen } from './JoinRequestsScreen';
import { OrgJoinScreen } from './OrgJoinScreen';
import { QrScanScreen } from './QrScanScreen';

// 조직 참여 화면은 서버 상태를 읽어 가짜 서버(src/features/my/org/testing)를 붙여 그린다 (#116)
function renderOrg(element: ReactElement, failList = false) {
  const participation = createParticipationServer({
    requests: EXISTING_REQUESTS,
  });
  if (failList) {
    participation.server.on('GET', PARTICIPATION_REQUESTS_PATH, networkError());
  }
  return renderWithApi(element, {
    server: participation.server,
    session: testSession(),
  });
}

describe('조직 참여 터치 영역', () => {
  // 글자만 있는 버튼이라 가장 작은 글자 설정의 글자 줄 높이가 보이는 크기다
  it('신청 현황 카드의 신청 취소는 글자 줄을 위아래로 넓힌다', async () => {
    await renderOrg(
      <JoinRequestsScreen onJoin={jest.fn()} onBack={jest.fn()} />,
    );

    const cancel = await screen.findByRole('button', {
      name: '한빛 설비 신청 취소',
    });
    expectMinTouchTarget(cancel, {
      height: smallestLineHeight('Caption/M/SemiBold'),
    });
  });

  // 신청 현황을 받지 못했을 때의 다시 시도 (#116)
  it('신청 현황의 다시 시도는 최소 터치 영역 이상이다', async () => {
    await renderOrg(
      <JoinRequestsScreen onJoin={jest.fn()} onBack={jest.fn()} />,
      true,
    );

    const retry = await screen.findByRole('button', { name: '다시 시도' });
    expectMinTouchTarget(retry, { height: stylePt(retry, 'minHeight') });
  });

  // 아이콘(24)만 보이는 버튼이라 hitSlop 으로 넓힌다 (#98)
  it('참여 요청을 보냈어요 › 신청 취소 모달의 X 는 최소 터치 영역 이상이다', async () => {
    await renderOrg(
      <JoinRequestedScreen
        request={{
          requestId: '1',
          organizationId: '10',
          organizationName: '한빛 설비',
          desiredType: 'TECHNICIAN',
          status: 'PENDING',
          requestedAt: '2026-09-23T01:24:00Z',
        }}
        onConfirm={jest.fn()}
        onCanceled={jest.fn()}
        onAlreadyDecided={jest.fn()}
        onBack={jest.fn()}
      />,
    );
    await userEvent.press(screen.getByRole('button', { name: '신청 취소' }));

    expectIconButtonTouchTarget(
      screen.getByTestId('cancel-request-modal-close'),
    );
  });

  // 입력칸은 hitSlop 으로 넓힐 수 없어 보이는 높이가 터치 영역이다. 온보딩 Figma 는 46 이다 (#85)
  it('온보딩 회사 코드 입력칸은 최소 터치 영역 이상이다', async () => {
    await renderOrg(
      <OrgJoinScreen
        flow="onboarding"
        onBack={jest.fn()}
        onFound={jest.fn()}
      />,
    );

    const input = screen.getByLabelText('회사 코드 입력');
    expectMinTouchTarget(input, { height: stylePt(input, 'minHeight') });
  });

  // QR 코드 인식(#108)의 닫기는 아이콘(24)만 보이는 버튼이라 hitSlop 으로 넓힌다
  it('QR 코드 인식의 닫기는 최소 터치 영역 이상이다', async () => {
    await renderOrg(
      <QrScanScreen focused onClose={jest.fn()} onFound={jest.fn()} />,
    );

    expectIconButtonTouchTarget(screen.getByRole('button', { name: '닫기' }));
  });
});
