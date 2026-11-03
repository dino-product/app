import { membershipsMock } from '../mockData';
import {
  decideParticipationMock,
  lookupCompanyMock,
  mockCompanyCodes,
  participationRequestsMock,
} from './mockData';
import { isCompanyCodeComplete, type ParticipationRequest } from './model';

describe('lookupCompanyMock', () => {
  const lookup = (code: string) =>
    lookupCompanyMock(code, membershipsMock, participationRequestsMock);

  // 앱은 규칙을 채운 코드로만 찾으므로 목 코드도 규칙 안에 있어야 한다 (#97)
  it('목 회사 코드는 모두 서버 규칙(Crockford Base32 6자)을 채운다', () => {
    expect(mockCompanyCodes).toContain('123456');
    expect(
      mockCompanyCodes.filter(code => !isCompanyCodeComplete(code)),
    ).toEqual([]);
  });

  it('없는 코드는 null (서버 404)', () => {
    expect(lookup('ZZZZZZ')).toBeNull();
  });

  it('처음 참여하는 회사는 대소문자·공백·하이픈과 상관없이 참여할 수 있다', () => {
    expect(lookup(' rbt-124 ')).toMatchObject({
      organizationName: 'Orbit',
      availability: 'AVAILABLE',
    });
  });

  it('활성 소속 회사는 이미 참여, 비활성 소속만 있으면 다시 요청할 수 있다', () => {
    expect(lookup('BS0001')?.availability).toBe('ALREADY_MEMBER');
    expect(lookup('FD0002')?.availability).toBe('AVAILABLE');
  });

  it('승인 대기 중인 요청이 있으면 그 요청을 알려준다', () => {
    expect(lookup('HB0010')).toMatchObject({
      availability: 'PENDING_REQUEST',
      pendingRequestId: 'request-1',
    });
  });
});

// 온보딩(#85)에서 승인 대기 › '확인' 을 누르면 사무실이 결정한 것으로 친다. 결과는 회사 코드로 고른다
describe('decideParticipationMock', () => {
  const requestTo = (
    code: string,
    desiredType: ParticipationRequest['desiredType'] = 'TECHNICIAN',
  ): ParticipationRequest => {
    const organization = lookupCompanyMock(code, [], []);
    if (!organization) {
      throw new Error(`없는 회사 코드: ${code}`);
    }
    return {
      organizationId: organization.organizationId,
      organizationName: organization.organizationName,
      requestId: 'request-1',
      desiredType,
      status: 'PENDING',
      requestChannel: 'COMPANY_CODE',
      requestedAt: '2026-09-23T01:24:00Z',
    };
  };

  it('Figma 예시 코드 123456 은 Orbit 이고, 요청한 유형 그대로 승인한다', () => {
    const request = requestTo('123456', 'STAFF');

    expect(request.organizationName).toBe('Orbit');
    expect(decideParticipationMock(request)).toEqual({
      status: 'APPROVED',
      approvedType: 'STAFF',
    });
  });

  it('234567 은 요청과 다른 유형으로 승인한다 (유형 변경)', () => {
    expect(decideParticipationMock(requestTo('234567', 'TECHNICIAN'))).toEqual({
      status: 'APPROVED',
      approvedType: 'STAFF',
    });
    expect(decideParticipationMock(requestTo('234567', 'STAFF'))).toEqual({
      status: 'APPROVED',
      approvedType: 'TECHNICIAN',
    });
  });

  it('345678 은 사유와 함께 거절한다', () => {
    expect(decideParticipationMock(requestTo('345678'))).toEqual({
      status: 'REJECTED',
      rejectReason: '현재 기사 인원이 충분해 요청을 받지 않고 있어요.',
    });
  });

  it('그 밖의 회사는 요청한 유형으로 승인한다', () => {
    expect(decideParticipationMock(requestTo('RBT124', 'STAFF'))).toEqual({
      status: 'APPROVED',
      approvedType: 'STAFF',
    });
  });
});
