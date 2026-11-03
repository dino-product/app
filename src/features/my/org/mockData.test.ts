import { membershipsMock } from '../mockData';
import { lookupCompanyMock, participationRequestsMock } from './mockData';

describe('lookupCompanyMock', () => {
  const lookup = (code: string) =>
    lookupCompanyMock(code, membershipsMock, participationRequestsMock);

  it('없는 코드는 null (서버 404)', () => {
    expect(lookup('NOPE')).toBeNull();
  });

  it('처음 참여하는 회사는 대소문자·공백·하이픈과 상관없이 참여할 수 있다', () => {
    expect(lookup(' orbit-1245 ')).toMatchObject({
      organizationName: 'Orbit',
      availability: 'AVAILABLE',
    });
  });

  it('활성 소속 회사는 이미 참여, 비활성 소속만 있으면 다시 요청할 수 있다', () => {
    expect(lookup('OBS0001')?.availability).toBe('ALREADY_MEMBER');
    expect(lookup('FIELD0002')?.availability).toBe('AVAILABLE');
  });

  it('승인 대기 중인 요청이 있으면 그 요청을 알려준다', () => {
    expect(lookup('HANBIT10')).toMatchObject({
      availability: 'PENDING_REQUEST',
      pendingRequestId: 'request-1',
    });
  });
});
