import { screen } from '@testing-library/react-native';
import { colors } from '../../../../shared/design-system';
import { iconSvgs } from '../../../../shared/design-system/icons/svgs';
import { svgViewsDrawing } from '../../../../shared/testing/icon';
import { renderWithApi } from '../../../../shared/testing/renderWithApi';
import { testSession } from '../../../../shared/testing/session';
import type { ParticipationRequest } from '../model';
import { JoinRequestedScreen } from './JoinRequestedScreen';

// 승인 대기(온보딩 3227:8824)·요청완료(마이 3235:14886)의 체크 아이콘 (#194).
// 맨 위 App Icon 은 DesignSystem App Icon · Modal-check(2791:27085) 인스턴스이고,
// 진행 단계 첫 원(3227:8844 · 3235:14906)은 같은 체크 그림을 흰색으로 그린 Secondary 원이다.
// 화면 구조와 상관없이 그 아이콘을 그리는지(개수·크기·색)만 본다. 아이콘 모양은 Icon.test, 진행 표시 배치는 JoinRequestedScreen.test 가 본다
const request: ParticipationRequest = {
  requestId: '9',
  organizationId: '9',
  organizationName: 'Orbit',
  desiredType: 'TECHNICIAN',
  status: 'PENDING',
  requestChannel: 'COMPANY_CODE',
  requestedAt: new Date(2026, 8, 23, 10, 24).toISOString(),
};

const renderRequested = (flow: 'my' | 'onboarding') =>
  renderWithApi(
    <JoinRequestedScreen
      flow={flow}
      request={request}
      onConfirm={jest.fn()}
      onCanceled={jest.fn()}
      onAlreadyDecided={jest.fn()}
      onBack={jest.fn()}
    />,
    { session: testSession() },
  );

describe.each(['my', 'onboarding'] as const)(
  'JoinRequestedScreen 체크 아이콘 (%s)',
  flow => {
    // 마이(3235:14899)·온보딩(3227:8837) 모두 인스턴스 크기 40 이다
    it('맨 위에 App Icon · Modal-check(modal-check)를 40 으로 하나 그린다', async () => {
      await renderRequested(flow);

      const icons = svgViewsDrawing(screen.root, iconSvgs['modal-check'].xml);
      expect(icons).toHaveLength(1);
      expect(icons[0].props).toMatchObject({ width: 40, height: 40 });
    });

    it('진행 단계 첫 원에 단계 체크(check)를 흰색으로 하나 그린다', async () => {
      await renderRequested(flow);

      const checks = svgViewsDrawing(screen.root, iconSvgs.check.xml);
      expect(checks).toHaveLength(1);
      expect(checks[0].props.color).toBe(colors.white[100]);
    });
  },
);
