import {
  formatRequestDate,
  formatRequestedAt,
  lookupOutcome,
  normalizeCompanyCode,
  pendingRequests,
  type ParticipationRequest,
} from './model';

describe('normalizeCompanyCode', () => {
  // 서버(RequestParticipationRequest)와 같은 규칙: 대소문자·공백·하이픈 무시
  it.each([
    ['Orbit1245', 'ORBIT1245'],
    [' orbit-1245 ', 'ORBIT1245'],
    ['OR BIT 12-45', 'ORBIT1245'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeCompanyCode(input)).toBe(expected);
  });
});

describe('lookupOutcome', () => {
  const organization = { organizationId: 'org-9', organizationName: 'Orbit' };

  it('참여할 수 있는 회사면 찾음이다', () => {
    expect(
      lookupOutcome({ ...organization, availability: 'AVAILABLE' }),
    ).toEqual({ kind: 'found', organization });
  });

  it('없는 코드(서버 404)면 유효하지 않음이다', () => {
    expect(lookupOutcome(null)).toEqual({ kind: 'invalid' });
  });

  it('이미 소속된 회사면 이미 참여다', () => {
    expect(
      lookupOutcome({ ...organization, availability: 'ALREADY_MEMBER' }),
    ).toEqual({ kind: 'alreadyMember', organization });
  });

  it('승인 대기 중인 요청이 있으면 대기 중이다', () => {
    expect(
      lookupOutcome({
        ...organization,
        availability: 'PENDING_REQUEST',
        pendingRequestId: 'request-3',
      }),
    ).toEqual({ kind: 'pending', organization });
  });
});

describe('요청 일시', () => {
  const at = new Date(2026, 8, 23, 10, 24).toISOString();

  it('요청 완료 요약은 2026-09-23 · 10:24 처럼 쓴다', () => {
    expect(formatRequestedAt(at)).toBe('2026-09-23 · 10:24');
  });

  it('한 자리 월·일·시·분도 두 자리로 맞춘다', () => {
    expect(formatRequestedAt(new Date(2026, 0, 5, 9, 3).toISOString())).toBe(
      '2026-01-05 · 09:03',
    );
  });

  it('신청 현황 카드는 날짜만 쓴다', () => {
    expect(formatRequestDate(at)).toBe('2026-09-23');
  });
});

describe('pendingRequests', () => {
  const request = (
    requestId: string,
    status: ParticipationRequest['status'],
  ): ParticipationRequest => ({
    requestId,
    organizationId: 'org-1',
    organizationName: 'Orbit',
    desiredType: 'TECHNICIAN',
    status,
    requestChannel: 'COMPANY_CODE',
    requestedAt: '2026-09-23T01:24:00Z',
  });

  it('승인 대기 요청만 고른다 (마이페이지 배지 숫자)', () => {
    expect(
      pendingRequests([
        request('a', 'PENDING'),
        request('b', 'REJECTED'),
        request('c', 'PENDING'),
        request('d', 'CANCELED'),
        request('e', 'APPROVED'),
      ]).map(item => item.requestId),
    ).toEqual(['a', 'c']);
  });
});
