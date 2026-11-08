import { render, screen } from '@testing-library/react-native';
import {
  expectMinTouchTarget,
  hitSlopOf,
  stylePt,
  type HostElement,
} from '../../../shared/testing/touchTarget';
import type { PendingRequest } from '../model';
import { PendingRequestCard } from './ScheduleRows';

const pending: PendingRequest = {
  id: 'p1',
  dateKey: '2026-12-20',
  title: '에어컨 필터 교체',
  status: 'assigned',
  timeRange: '14:00 – 15:00',
  company: '한빛 설비',
  customerName: '정다은',
  address: '서울 용산구 이태원로 202',
};

// 응답 필요 카드의 거절·수락은 높이 42 의 모달 CTA 다 (Figma 3754:6846). iOS 44 / Android 48 로 위아래를 넓힌다
describe('PendingRequestCard 터치 영역', () => {
  it('거절·수락은 최소 터치 영역을 채우고, 넓힌 영역은 카드 안(본문 아래 12·버튼 줄 아래 20)에 든다', async () => {
    await render(
      <PendingRequestCard
        item={pending}
        dayLabel="12. 20. (일)"
        onAccept={jest.fn()}
        onReject={jest.fn()}
        onOpen={jest.fn()}
      />,
    );

    const body = screen.getByRole('button', {
      name: /^에어컨 필터 교체 상세,/,
    });
    for (const name of ['에어컨 필터 교체 거절', '에어컨 필터 교체 수락']) {
      const button = screen.getByRole('button', { name });
      expectMinTouchTarget(button, { height: stylePt(button, 'minHeight') });
      const slop = hitSlopOf(button);
      const actions = button.parent as HostElement;
      expect(slop.top).toBeLessThanOrEqual(stylePt(body, 'paddingBottom'));
      expect(slop.bottom).toBeLessThanOrEqual(
        stylePt(actions, 'paddingBottom'),
      );
    }
  });
});
