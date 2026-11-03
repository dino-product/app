import {
  COMPANY_CODE_ALPHABET,
  COMPANY_CODE_LENGTH,
  formatRequestDate,
  formatRequestedAt,
  isCompanyCodeComplete,
  lookupOutcome,
  normalizeCompanyCode,
  pendingRequests,
  sanitizeCompanyCodeInput,
  type ParticipationRequest,
} from './model';

describe('normalizeCompanyCode', () => {
  // 서버(RequestParticipationRequest)와 같은 규칙: 대소문자·공백·하이픈 무시
  it.each([
    ['rbt124', 'RBT124'],
    [' rbt-124 ', 'RBT124'],
    ['RB T1-24', 'RBT124'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeCompanyCode(input)).toBe(expected);
  });
});

// 서버 규칙 (Dino CompanyCode): Crockford Base32 대문자 6자, I·L·O·U 는 쓰지 않는다 (#97)
describe('회사 코드 규칙', () => {
  it('Crockford Base32 대문자 32자(I·L·O·U 제외) 중 6자다', () => {
    expect(COMPANY_CODE_LENGTH).toBe(6);
    expect(COMPANY_CODE_ALPHABET).toBe('0123456789ABCDEFGHJKMNPQRSTVWXYZ');
  });

  describe('sanitizeCompanyCodeInput (입력칸에 들어갈 값)', () => {
    it.each([
      ['소문자는 대문자로', 'ab12cd', 'AB12CD'],
      ['붙여넣은 공백·하이픈은 지운다', 'ab-12 3c', 'AB123C'],
      ['I·L·O·U 는 입력되지 않는다', 'IiLlOoUu7', '7'],
      ['한글·특수문자·전각은 입력되지 않는다', '가A!@#ㅂ1_.,Ａ', 'A1'],
      ['6자를 넘게 입력되지 않는다', 'ABCDEFGH', 'ABCDEF'],
      ['허용 밖 문자를 뺀 뒤 6자로 자른다', 'O1-2 3U4L5I6Z', '123456'],
      ['줄바꿈·탭도 지운다', 'AB\n12\tC', 'AB12C'],
      ['빈 입력은 빈 값', '', ''],
    ])('%s: %s → %s', (_, input, expected) => {
      expect(sanitizeCompanyCodeInput(input)).toBe(expected);
    });

    // maxLength 처럼: 다 찬 칸의 가운데에 끼워 넣어도 맨 끝 글자가 밀려 지워지지 않는다
    it('이미 6자가 찼으면 더 입력해도 그대로다 (끼워 넣기·뒤에 붙여넣기 포함)', () => {
      expect(sanitizeCompanyCodeInput('XAB123C', 'AB123C')).toBe('AB123C');
      expect(sanitizeCompanyCodeInput('AB1Z23C', 'AB123C')).toBe('AB123C');
      expect(sanitizeCompanyCodeInput('AB123Cxy', 'AB123C')).toBe('AB123C');
    });

    it('다 찬 칸이라도 지우거나 바꾼 글자는 반영한다', () => {
      expect(sanitizeCompanyCodeInput('AB123', 'AB123C')).toBe('AB123');
      expect(sanitizeCompanyCodeInput('ZZZZZZ', 'AB123C')).toBe('ZZZZZZ');
      // 허용 밖 글자만 더한 경우는 6자 그대로다
      expect(sanitizeCompanyCodeInput('AB1-23C', 'AB123C')).toBe('AB123C');
    });

    it('다 찬 칸을 모두 골라 더 긴 코드를 붙여넣으면 새 코드의 앞 6자다', () => {
      expect(sanitizeCompanyCodeInput('zx-98 7wq', 'AB123C')).toBe('ZX987W');
    });

    it('허용 문자는 모두 그대로 들어간다', () => {
      for (const char of COMPANY_CODE_ALPHABET) {
        expect(sanitizeCompanyCodeInput(char)).toBe(char);
        expect(sanitizeCompanyCodeInput(char.toLowerCase())).toBe(char);
      }
    });
  });

  describe('isCompanyCodeComplete (회사 확인을 켤지)', () => {
    it.each(['', 'A', 'AB12', 'AB123'])('%p 처럼 6자 미만이면 아니다', code => {
      expect(isCompanyCodeComplete(code)).toBe(false);
    });

    it('허용 문자 6자면 맞다', () => {
      expect(isCompanyCodeComplete('AB123C')).toBe(true);
      expect(isCompanyCodeComplete('123456')).toBe(true);
    });

    it.each(['AB123CD', 'AB12OC', 'ab123c', 'AB 12C'])(
      '%p 처럼 6자를 넘거나 허용 밖 문자가 있으면 아니다',
      code => {
        expect(isCompanyCodeComplete(code)).toBe(false);
      },
    );
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
