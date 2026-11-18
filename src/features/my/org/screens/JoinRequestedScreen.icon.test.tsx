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
// 화면 구조와 상관없이 그린 아이콘만 본다 (진행 표시 배치는 JoinRequestedScreen.test 가 본다)
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
    it('맨 위 아이콘은 App Icon · Modal-check(Select/1 6% 원에 Secondary 체크, 40)다', async () => {
      await renderRequested(flow);

      const icons = svgViewsDrawing(screen.root, iconSvgs['modal-check'].xml);
      expect(icons).toHaveLength(1);
      expect(icons[0].props).toMatchObject({ width: 40, height: 40 });
      expect(icons[0].props.xml).toContain(
        'fill="#4F3BFE" fill-opacity="0.06"',
      );
      expect(icons[0].props.xml).not.toContain('linearGradient');
    });

    it('진행 단계 첫 원의 체크는 Figma 단계 원의 흰 체크 그림이다', async () => {
      await renderRequested(flow);

      const checks = svgViewsDrawing(screen.root, iconSvgs.check.xml);
      expect(checks).toHaveLength(1);
      expect(checks[0].props.color).toBe(colors.white[100]);
      expect(checks[0].props.xml).toContain(
        'd="M31.1045 20.8222C31.3605 20.5772',
      );
    });
  },
);
