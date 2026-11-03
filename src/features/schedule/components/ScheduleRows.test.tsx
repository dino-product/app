import { render, screen } from '@testing-library/react-native';
import {
  colors,
  pressedBackground,
  typography,
} from '../../../shared/design-system';
import { expectPressedBackground } from '../../../shared/testing/pressFeedback';
import type { HostElement } from '../../../shared/testing/touchTarget';
import type { ConfirmedSchedule, PendingRequest } from '../model';
import { ConfirmedRow, PendingRequestCard } from './ScheduleRows';

const confirmed: ConfirmedSchedule = {
  id: 'c1',
  dateKey: '2026-12-15',
  title: '세탁기 설치',
  status: 'assigned',
  timeRange: '08:00 - 09:00',
  company: '한빛 설비',
  customerName: '정다은',
  address: '서울 용산구 이태원로 202',
};

const pending: PendingRequest = {
  ...confirmed,
  id: 'p1',
  title: '에어컨 필터 교체',
  dateLabel: '9/20',
  timeRange: '14:00 – 15:00',
};

const fontOf = (variant: keyof typeof typography) => ({
  fontFamily: typography[variant].fontFamily,
  fontSize: typography[variant].fontSize,
});

// Figma 내 일정 › 확정 일정 (2714:12918) 의 일정 행
describe('ConfirmedRow', () => {
  it('행은 사방 24 여백, 줄 간격 10, 아래 Gray200 선이다', async () => {
    await render(<ConfirmedRow item={confirmed} />);

    expect(screen.getByLabelText(/^세탁기 설치, /)).toHaveStyle({
      padding: 24,
      gap: 10,
      borderBottomColor: colors.gray[200],
    });
  });

  it('제목은 Body/M/SemiBold 이다', async () => {
    await render(<ConfirmedRow item={confirmed} />);

    expect(screen.getByText('세탁기 설치')).toHaveStyle(
      fontOf('Body/M/SemiBold'),
    );
  });

  it('시간 줄은 24 달력 아이콘과 5 간격으로 위에 맞춘다', async () => {
    await render(<ConfirmedRow item={confirmed} />);

    const timeRow = screen.getByText('08:00 - 09:00').parent as HostElement;
    expect(timeRow).toHaveStyle({ gap: 5, alignItems: 'flex-start' });
    expect(timeRow.children[0]).toHaveStyle({ width: 24, height: 24 });
  });

  it('업체·고객 줄은 간격 8, Gray400 구분선, 모두 Caption/M/Medium 이다', async () => {
    await render(<ConfirmedRow item={confirmed} />);

    const company = screen.getByText('한빛 설비');
    const meta = company.parent as HostElement;
    expect(meta).toHaveStyle({ gap: 8 });
    expect(meta.children[1]).toHaveStyle({ backgroundColor: colors.gray[400] });
    expect(company).toHaveStyle(fontOf('Caption/M/Medium'));
    expect(screen.getByText('정다은 · 서울 용산구 이태원로 202')).toHaveStyle({
      ...fontOf('Caption/M/Medium'),
      color: colors.gray[600],
    });
  });
});

// Figma 내 일정 › 응답 필요 (2367:12834) 의 요청 카드
describe('ConfirmedRow 눌림 (#102)', () => {
  it('누를 수 있는 행은 누르고 있는 동안 배경이 Gray50 이 되고 떼면 돌아온다', async () => {
    await render(<ConfirmedRow item={confirmed} onPress={jest.fn()} />);

    await expectPressedBackground(
      screen.getByRole('button', { name: /^세탁기 설치, / }),
      pressedBackground.onWhite,
    );
  });
});

describe('PendingRequestCard', () => {
  const renderCard = () =>
    render(
      <PendingRequestCard
        item={pending}
        onAccept={jest.fn()}
        onReject={jest.fn()}
        onOpen={jest.fn()}
      />,
    );

  it('제목은 Body/M/SemiBold 에 P/T/01 색이다', async () => {
    await renderCard();

    expect(screen.getByText('에어컨 필터 교체')).toHaveStyle({
      ...fontOf('Body/M/SemiBold'),
      color: colors.pt01,
    });
  });

  it('날짜·시간은 Body/XS/SemiBold Gray700, 업체명은 Caption/M/SemiBold 이다', async () => {
    await renderCard();

    expect(screen.getByText('9/20 · 14:00 – 15:00')).toHaveStyle({
      ...fontOf('Body/XS/SemiBold'),
      color: colors.gray[700],
    });
    expect(screen.getByText('한빛 설비')).toHaveStyle(
      fontOf('Caption/M/SemiBold'),
    );
  });

  // 칩 줄 → 14 → 제목·업체 줄(사이 8) → 16 → 버튼 줄(사이 10)
  it('칩 줄과 제목 사이 14, 제목과 업체 줄 사이 8, 버튼 줄 위 16, 버튼 사이 10 이다', async () => {
    await renderCard();

    const titleBlock = screen.getByText('에어컨 필터 교체')
      .parent as HostElement;
    expect(titleBlock).toHaveStyle({ gap: 8 });
    expect(titleBlock.parent).toHaveStyle({ gap: 14 });
    const actions = screen.getByRole('button', {
      name: '에어컨 필터 교체 수락',
    }).parent as HostElement;
    expect(actions).toHaveStyle({ gap: 10 });
    // 누르는 본문이 눌림 배경을 카드 위·옆 끝까지 칠하도록 여백을 본문·버튼 줄이 나눠 갖는다 (#102)
    const body = titleBlock.parent as HostElement;
    expect(body).toHaveStyle({
      paddingTop: 24,
      paddingHorizontal: 24,
      paddingBottom: 16,
    });
    expect(actions).toHaveStyle({ paddingHorizontal: 24, paddingBottom: 24 });
    expect(actions.parent).toHaveStyle({ gap: 0, padding: 0 });
  });

  // #102: 누르는 본문(상세 열기)만 회색이 되고, 거절·수락 버튼 줄은 그대로다
  it('본문을 누르고 있는 동안 본문 배경이 Gray50 이 되고 떼면 돌아온다', async () => {
    await renderCard();

    await expectPressedBackground(
      screen.getByRole('button', { name: /^에어컨 필터 교체 상세,/ }),
      pressedBackground.onWhite,
    );
  });

  it('거절·수락은 높이 46, 반경 12 의 M 버튼이다', async () => {
    await renderCard();

    for (const name of ['에어컨 필터 교체 거절', '에어컨 필터 교체 수락']) {
      expect(screen.getByRole('button', { name })).toHaveStyle({
        minHeight: 46,
        borderRadius: 12,
      });
    }
    expect(screen.getByText('수락')).toHaveStyle(fontOf('Body/XS/Medium'));
  });
});
