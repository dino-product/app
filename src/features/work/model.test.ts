import {
  canSubmitReport,
  emptyReport,
  formatAmount,
  formatPrice,
  formatResultTime,
  formatSubmittedAt,
  formatWon,
  hasReportInput,
  paymentMethodLabels,
  PHOTO_LIMIT,
  type WorkReport,
} from './model';

const filled: WorkReport = {
  ...emptyReport,
  beforePhotos: ['a'],
  afterPhotos: ['b'],
  amount: '75000',
  paymentMethod: 'card',
};

describe('canSubmitReport', () => {
  it('작업 전·후 사진, 결제 금액·방식이 모두 있으면 제출할 수 있다', () => {
    expect(canSubmitReport(filled)).toBe(true);
  });

  it.each<[string, Partial<WorkReport>]>([
    ['작업 전 사진이 없으면', { beforePhotos: [] }],
    ['작업 후 사진이 없으면', { afterPhotos: [] }],
    ['결제 금액이 비어 있으면', { amount: '' }],
    ['결제 금액이 0 이면', { amount: '0' }],
    ['결제 방식을 고르지 않았으면', { paymentMethod: null }],
  ])('%s 제출할 수 없다', (_, patch) => {
    expect(canSubmitReport({ ...filled, ...patch })).toBe(false);
  });

  it('수행 메모와 사용 부품은 선택 항목이다', () => {
    expect(canSubmitReport({ ...filled, memo: '', parts: '' })).toBe(true);
  });
});

describe('hasReportInput', () => {
  it('아무것도 입력하지 않았으면 입력이 없다', () => {
    expect(hasReportInput(emptyReport)).toBe(false);
  });

  it.each<[string, Partial<WorkReport>]>([
    ['작업 전 사진', { beforePhotos: ['a'] }],
    ['작업 후 사진', { afterPhotos: ['b'] }],
    ['수행 메모', { memo: '배관 교체' }],
    ['사용 부품', { parts: '밸브' }],
    ['결제 금액', { amount: '75000' }],
    ['결제 방식', { paymentMethod: 'cash' }],
  ])('%s 하나만 있어도 입력이 있다', (_, patch) => {
    expect(hasReportInput({ ...emptyReport, ...patch })).toBe(true);
  });

  it('공백만 쓴 메모·부품은 입력으로 보지 않는다', () => {
    expect(hasReportInput({ ...emptyReport, memo: '  ', parts: '\n' })).toBe(
      false,
    );
  });
});

describe('formatWon', () => {
  it('천 단위 쉼표와 "원" 을 붙인다', () => {
    expect(formatWon(75000)).toBe('75,000원');
    expect(formatWon(1234567)).toBe('1,234,567원');
    expect(formatWon(0)).toBe('0원');
  });
});

describe('formatAmount', () => {
  it('입력한 숫자에 천 단위 쉼표만 넣는다 (formatWon 과 같은 규칙)', () => {
    expect(formatAmount('120000')).toBe('120,000');
    expect(formatAmount('1234567')).toBe('1,234,567');
    expect(formatAmount('750')).toBe('750');
  });

  it('비어 있으면 그대로 비워 placeholder 가 보이게 한다', () => {
    expect(formatAmount('')).toBe('');
  });
});

describe('formatPrice', () => {
  it('가격이 있으면 formatWon 으로 보여준다', () => {
    expect(formatPrice(75000)).toBe('75,000원');
  });

  it('가격이 정해지지 않았으면 "- 원" 이다', () => {
    expect(formatPrice(null)).toBe('- 원');
  });
});

it('현장 사진은 단계별 최대 6장이다 (백엔드 CompletionReport 와 같다)', () => {
  expect(PHOTO_LIMIT).toBe(6);
});

it('결제 방식은 Figma 드롭다운 목록 순서·이름을 따른다 (백엔드 실제 결제 방식 4가지)', () => {
  expect(Object.entries(paymentMethodLabels)).toEqual([
    ['card', '현장 카드'],
    ['cash', '현장 현금'],
    ['transfer', '계좌 이체'],
    ['invoice', '청구서 발행(후불)'],
  ]);
});

describe('formatSubmittedAt', () => {
  it('"YYYY-MM-DD HH:mm" 로 표기한다', () => {
    expect(formatSubmittedAt(new Date(2026, 11, 19, 11, 32))).toBe(
      '2026-12-19 11:32',
    );
    expect(formatSubmittedAt(new Date(2026, 0, 5, 9, 7))).toBe(
      '2026-01-05 09:07',
    );
  });
});

describe('formatResultTime', () => {
  it('"MM.DD HH:mm" 로 표기한다', () => {
    expect(formatResultTime(new Date(2026, 9, 1, 15, 5))).toBe('10.01 15:05');
  });
});
