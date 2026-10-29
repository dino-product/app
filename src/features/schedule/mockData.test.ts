import { workDetail } from '../work/mockData';
import { makeScheduleMock, requestToWorkDetail } from './mockData';

describe('requestToWorkDetail', () => {
  it('요청의 작업명·상태·시간·주소와 요청일(요일 포함)을 상세에 옮긴다', () => {
    const today = new Date(2026, 11, 15);
    const [request] = makeScheduleMock(today).pending;

    const detail = requestToWorkDetail(request);

    expect(detail).toMatchObject({
      title: request.title,
      status: request.status,
      timeRange: request.timeRange,
      address: request.address,
      date: '2026-12-20 (일)',
    });
    // 작업번호는 요청 id 가 아니라 작업번호 형식을 유지한다
    expect(detail.id).toBe(workDetail.id);
  });
});
