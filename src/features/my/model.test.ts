import {
  canSaveProfile,
  canWithdraw,
  formatJoinDate,
  formatPhoneNumber,
  formatRelativeTime,
  withdrawalBlockCards,
  type WithdrawalEligibility,
} from './model';

describe('formatPhoneNumber', () => {
  it.each([
    ['01012345678', '010-1234-5678'],
    ['010-1234-5678', '010-1234-5678'],
    ['010 1234 5678', '010-1234-5678'],
  ])('%s → %s', (input, expected) => {
    expect(formatPhoneNumber(input)).toBe(expected);
  });

  // 입력하는 동안에도 자리마다 하이픈이 붙는다
  it.each([
    ['', ''],
    ['0', '0'],
    ['010', '010'],
    ['0101', '010-1'],
    ['0101234', '010-1234'],
    ['01012345', '010-1234-5'],
  ])('입력 중 %s → %s', (input, expected) => {
    expect(formatPhoneNumber(input)).toBe(expected);
  });

  it('11자리를 넘는 숫자는 버린다', () => {
    expect(formatPhoneNumber('0101234567890')).toBe('010-1234-5678');
  });
});

describe('formatJoinDate', () => {
  it('가입 시각을 2024.03.15 처럼 쓴다', () => {
    expect(formatJoinDate(new Date(2024, 2, 15, 12).toISOString())).toBe(
      '2024.03.15',
    );
  });

  it('한 자리 월·일도 두 자리로 맞춘다', () => {
    expect(formatJoinDate(new Date(2025, 0, 5, 12).toISOString())).toBe(
      '2025.01.05',
    );
  });
});

describe('formatRelativeTime', () => {
  const now = new Date(2026, 10, 2, 15, 0);
  const ago = (minutes: number) =>
    new Date(now.getTime() - minutes * 60_000).toISOString();

  it.each([
    [0, '방금 전'],
    [0.5, '방금 전'],
    [1, '1분 전'],
    [59, '59분 전'],
    [60, '1시간 전'],
    [3 * 60, '3시간 전'],
    [21 * 60 + 59, '21시간 전'],
    [24 * 60, '1일 전'],
    [2 * 24 * 60 + 30, '2일 전'],
  ])('%d분 전 → %s', (minutes, expected) => {
    expect(formatRelativeTime(ago(minutes), now)).toBe(expected);
  });

  it('기기 시계가 서버보다 늦어 미래 시각이 와도 방금 전으로 쓴다', () => {
    expect(formatRelativeTime(ago(-5), now)).toBe('방금 전');
  });
});

describe('canSaveProfile', () => {
  const saved = { name: '김현진', phoneNumber: '01012345678' };

  it('바뀐 값이 없으면 저장할 수 없다', () => {
    expect(canSaveProfile(saved, saved)).toBe(false);
  });

  it('이름이나 연락처가 바뀌고 올바르면 저장할 수 있다', () => {
    expect(canSaveProfile(saved, { ...saved, name: '박기사' })).toBe(true);
    expect(
      canSaveProfile(saved, { ...saved, phoneNumber: '01098765432' }),
    ).toBe(true);
  });

  it('하이픈을 넣어 보여 준 연락처도 숫자만 비교한다', () => {
    expect(
      canSaveProfile(saved, { ...saved, phoneNumber: '010-1234-5678' }),
    ).toBe(false);
  });

  // 서버 규칙: 이름은 앞뒤 공백을 지운 뒤 2~20자 한글·영문, 연락처는 010 으로 시작하는 11자리
  it.each([
    ['이름이 한 글자', { name: '김' }],
    ['이름이 20자를 넘음', { name: '가'.repeat(21) }],
    ['이름에 숫자', { name: '김기사2' }],
    ['이름 가운데 공백', { name: '김 기사' }],
    ['연락처가 10자리', { phoneNumber: '0101234567' }],
    ['연락처가 010 으로 시작하지 않음', { phoneNumber: '01112345678' }],
  ])('%s 이면 저장할 수 없다', (_, patch) => {
    expect(canSaveProfile(saved, { ...saved, ...patch })).toBe(false);
  });

  it('이름 앞뒤 공백은 지우고 판단한다', () => {
    expect(canSaveProfile(saved, { ...saved, name: ' 박기사 ' })).toBe(true);
    expect(canSaveProfile(saved, { ...saved, name: ' 김현진 ' })).toBe(false);
  });
});

describe('탈퇴 가능 여부', () => {
  const eligibility = (
    patch: Partial<WithdrawalEligibility>,
  ): WithdrawalEligibility => ({ withdrawable: true, blocks: [], ...patch });

  it('막는 사유가 없으면 탈퇴할 수 있다', () => {
    expect(canWithdraw(eligibility({}))).toBe(true);
  });

  it('막는 사유가 있으면 탈퇴할 수 없다', () => {
    expect(
      canWithdraw(
        eligibility({
          withdrawable: false,
          blocks: [{ reason: 'WORK_IN_PROGRESS', count: 1 }],
        }),
      ),
    ).toBe(false);
  });

  // 서버가 둘을 함께 주므로 어긋나면 막힌 쪽으로 본다
  it('withdrawable 이 true 여도 막는 사유가 있으면 탈퇴할 수 없다', () => {
    expect(
      canWithdraw(
        eligibility({ blocks: [{ reason: 'WORK_PENDING_ACCEPT', count: 2 }] }),
      ),
    ).toBe(false);
  });

  it('withdrawable 이 false 면 사유가 비어 있어도 탈퇴할 수 없다', () => {
    expect(canWithdraw(eligibility({ withdrawable: false }))).toBe(false);
  });
});

describe('withdrawalBlockCards', () => {
  it('진행 중인 작업 → 미완료 작업 배정 → 유일한 총관리자 순서로 문구를 만든다', () => {
    expect(
      withdrawalBlockCards([
        { reason: 'SOLE_OWNER', count: 1 },
        { reason: 'WORK_PENDING_ACCEPT', count: 2 },
        { reason: 'WORK_IN_PROGRESS', count: 1 },
      ]),
    ).toEqual([
      {
        reason: 'WORK_IN_PROGRESS',
        title: '진행 중인 작업',
        count: 1,
        description: '현재 작업 중 상태인 작업 1건이 있습니다',
      },
      {
        reason: 'WORK_PENDING_ACCEPT',
        title: '미완료 작업 배정',
        count: 2,
        description: '수락 대기 중인 작업 2건이 있습니다',
      },
      {
        reason: 'SOLE_OWNER',
        title: '유일한 총관리자',
        count: 1,
        description: '총관리자가 나 혼자인 발주사 1곳이 있습니다',
      },
    ]);
  });

  it('건수가 0 인 사유는 뺀다', () => {
    expect(
      withdrawalBlockCards([
        { reason: 'WORK_IN_PROGRESS', count: 0 },
        { reason: 'WORK_PENDING_ACCEPT', count: 2 },
      ]).map(card => card.reason),
    ).toEqual(['WORK_PENDING_ACCEPT']);
  });
});
