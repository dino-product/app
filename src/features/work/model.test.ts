import {
  canSubmitReport,
  emptyReport,
  formatAmount,
  formatPrice,
  formatResultTime,
  formatSubmittedAt,
  formatWon,
  hasReportInput,
  mondayWeek,
  paymentMethodLabels,
  PHOTO_LIMIT,
  reportFromPlan,
  type WorkDetail,
  type WorkReport,
} from './model';

// #94: 내 작업 블록 보기는 Figma 대로 월요일부터 일요일까지다 (내 일정 주간 줄은 일요일 시작)
describe('mondayWeek', () => {
  const dates = (days: Date[]) =>
    days.map(day => `${day.getMonth() + 1}/${day.getDate()}(${day.getDay()})`);

  it.each([
    ['월요일', new Date(2026, 8, 14)],
    ['토요일', new Date(2026, 8, 19)],
    ['일요일', new Date(2026, 8, 20)],
  ])('%s 이 속한 주는 그 주 월요일부터 일요일까지 7일이다', (_, date) => {
    expect(dates(mondayWeek(date))).toEqual([
      '9/14(1)',
      '9/15(2)',
      '9/16(3)',
      '9/17(4)',
      '9/18(5)',
      '9/19(6)',
      '9/20(0)',
    ]);
  });

  it('달이 바뀌는 주도 이어진다', () => {
    expect(dates(mondayWeek(new Date(2026, 9, 1)))).toEqual([
      '9/28(1)',
      '9/29(2)',
      '9/30(3)',
      '10/1(4)',
      '10/2(5)',
      '10/3(6)',
      '10/4(0)',
    ]);
  });
});

const filled: WorkReport = {
  ...emptyReport,
  amount: '75000',
  paymentMethod: 'card',
};

// #150 사용자 결정(선택지 C): 결제 방식과 결제 금액(0 보다 큼)만 필수다.
// 백엔드 완료 보고 요청은 배정 순번 말고는 모두 비워 보낼 수 있고, Figma 는 수행 메모·사용 부품에만 '(선택)' 을 단다
describe('canSubmitReport', () => {
  it('결제 금액과 결제 방식이 있으면 제출할 수 있다', () => {
    expect(canSubmitReport(filled)).toBe(true);
  });

  it.each<[string, Partial<WorkReport>]>([
    ['결제 금액이 비어 있으면', { amount: '' }],
    ['결제 금액이 0 이면', { amount: '0' }],
    ['결제 방식을 고르지 않았으면', { paymentMethod: null }],
  ])('%s 제출할 수 없다', (_, patch) => {
    expect(canSubmitReport({ ...filled, ...patch })).toBe(false);
  });

  it('작업 전·후 사진은 없어도 제출할 수 있다', () => {
    expect(
      canSubmitReport({ ...filled, beforePhotos: [], afterPhotos: [] }),
    ).toBe(true);
  });

  it('수행 메모와 사용 부품은 쓰든 말든 제출 여부에 영향이 없다', () => {
    expect(canSubmitReport({ ...filled, memo: '', parts: '' })).toBe(true);
    expect(canSubmitReport({ ...filled, memo: '배관', parts: '밸브' })).toBe(
      true,
    );
    expect(
      canSubmitReport({ ...emptyReport, memo: '배관', parts: '밸브' }),
    ).toBe(false);
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

  describe('계획값으로 미리 채운 보고와 비교할 때', () => {
    const planned = {
      ...emptyReport,
      amount: '75000',
      paymentMethod: 'card',
    } as const;

    it('미리 채운 그대로면 입력이 없다', () => {
      expect(hasReportInput(planned, planned)).toBe(false);
    });

    it('금액·결제 방식을 바꾸거나 비우면 입력이 있다', () => {
      expect(hasReportInput({ ...planned, amount: '80000' }, planned)).toBe(
        true,
      );
      expect(hasReportInput({ ...planned, amount: '' }, planned)).toBe(true);
      expect(
        hasReportInput({ ...planned, paymentMethod: 'cash' }, planned),
      ).toBe(true);
    });

    it('사진·메모를 넣으면 입력이 있다', () => {
      expect(hasReportInput({ ...planned, afterPhotos: ['a'] }, planned)).toBe(
        true,
      );
    });
  });
});

describe('reportFromPlan', () => {
  it('완료 보고 결제 금액을 작업의 계획값으로 미리 채운다', () => {
    expect(reportFromPlan({ price: 75000 })).toEqual({
      ...emptyReport,
      amount: '75000',
    });
  });

  // #150 결제 방식은 기사가 직접 고른다. 고르는 것이 제출 버튼을 여는 계기다
  it('작업에 계획한 결제 방식이 있어도 결제 방식은 고르지 않은 채로 둔다', () => {
    const plannedWork: Pick<WorkDetail, 'price' | 'paymentMethod'> = {
      price: 75000,
      paymentMethod: 'invoice',
    };

    expect(reportFromPlan(plannedWork).paymentMethod).toBeNull();
  });

  it('계획값이 없으면 빈 칸이다', () => {
    expect(reportFromPlan({ price: null })).toEqual(emptyReport);
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
