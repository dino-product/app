import { render, screen, within } from '@testing-library/react-native';
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
  dateKey: '2026-12-20',
  title: '에어컨 필터 교체',
  timeRange: '14:00 – 15:00',
};

const fontOf = (variant: keyof typeof typography) => ({
  fontFamily: typography[variant].fontFamily,
  fontSize: typography[variant].fontSize,
});

// Figma 내 일정 › 확정 일정 카드 (3754:6312) · 응답 필요 카드 (3754:6846) 의 같은 윗부분
describe.each([
  {
    label: 'ConfirmedRow',
    title: '세탁기 설치',
    time: '08:00 - 09:00',
    day: '오늘 · 12. 15. (화)',
    renderCard: () =>
      render(<ConfirmedRow item={confirmed} dayLabel="오늘 · 12. 15. (화)" />),
  },
  {
    label: 'PendingRequestCard',
    title: '에어컨 필터 교체',
    time: '14:00 – 15:00',
    day: '12. 20. (일)',
    renderCard: () =>
      render(
        <PendingRequestCard
          item={pending}
          dayLabel="12. 20. (일)"
          onAccept={jest.fn()}
          onReject={jest.fn()}
          onOpen={jest.fn()}
        />,
      ),
  },
])('$label 윗부분', ({ title, time, day, renderCard }) => {
  it('제목은 Body/S/SemiBold Gray900, 그 아래 6 에 시간(Gray900)과 날짜(Gray600)를 Caption/M/Medium 으로 잇는다', async () => {
    await renderCard();

    const titleText = screen.getByText(title);
    expect(titleText).toHaveStyle({
      ...fontOf('Body/S/SemiBold'),
      color: colors.gray[900],
    });
    const timeLine = screen.getByText(`${time}  ${day}`);
    expect(timeLine).toHaveStyle({
      ...fontOf('Caption/M/Medium'),
      color: colors.gray[900],
    });
    expect(screen.getByText(day)).toHaveStyle({ color: colors.gray[600] });
    expect(titleText.parent).toHaveStyle({ gap: 6 });
    expect(timeLine.parent).toBe(titleText.parent);
  });

  // 칩은 제목·시간 묶음 오른쪽 위에 붙는다
  it('칩은 제목·시간 묶음의 오른쪽 위에 있다', async () => {
    await renderCard();

    const summary = screen.getByText(title).parent as HostElement;
    const titleRow = summary.parent as HostElement;
    expect(titleRow).toHaveStyle({
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    });
    expect(titleRow.children[0]).toBe(summary);
    expect(titleRow.children).toHaveLength(2);
    expect(
      within(titleRow.children[1] as HostElement).getByText('배정됨'),
    ).toBeOnTheScreen();
  });

  it('업체·고객 줄은 간격 8, Gray400 구분선, 업체 Gray800·고객 Gray600 모두 Caption/M/Medium 이다', async () => {
    await renderCard();

    const company = screen.getByText('한빛 설비');
    const meta = company.parent as HostElement;
    expect(meta).toHaveStyle({ gap: 8 });
    expect(meta.children[1]).toHaveStyle({
      width: 1,
      height: 12,
      backgroundColor: colors.gray[400],
    });
    expect(company).toHaveStyle({
      ...fontOf('Caption/M/Medium'),
      color: colors.gray[800],
    });
    expect(screen.getByText('정다은 · 서울 용산구 이태원로 202')).toHaveStyle({
      ...fontOf('Caption/M/Medium'),
      color: colors.gray[600],
    });
  });
});

describe('ConfirmedRow', () => {
  // Figma 3754:6312: 흰 카드, 모서리 16, 사방 20, 줄 사이 6, 아래만 Gray50 선
  it('흰 카드에 모서리 16, 사방 20, 줄 사이 6, 아래 Gray50 선이다', async () => {
    await render(
      <ConfirmedRow item={confirmed} dayLabel="오늘 · 12. 15. (화)" />,
    );

    expect(screen.getByLabelText(/^세탁기 설치, /)).toHaveStyle({
      backgroundColor: colors.white[100],
      borderRadius: 16,
      padding: 20,
      gap: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray[50],
    });
  });

  it('스크린리더는 제목, 상태, 시간과 날짜, 업체·고객·주소를 한 번에 읽는다', async () => {
    await render(
      <ConfirmedRow item={confirmed} dayLabel="오늘 · 12. 15. (화)" />,
    );

    expect(
      screen.getByLabelText(
        '세탁기 설치, 배정됨, 08:00 - 09:00 오늘 · 12. 15. (화), 한빛 설비 정다은 · 서울 용산구 이태원로 202',
      ),
    ).toBeOnTheScreen();
  });

  it('달력 아이콘 없이 시간 줄을 보인다', async () => {
    await render(
      <ConfirmedRow item={confirmed} dayLabel="오늘 · 12. 15. (화)" />,
    );

    const timeLine = screen.getByText('08:00 - 09:00  오늘 · 12. 15. (화)');
    expect(timeLine.parent?.children).toHaveLength(2);
  });
});

describe('ConfirmedRow 눌림 (#102)', () => {
  it('누를 수 있는 카드는 누르고 있는 동안 배경이 Gray50 이 되고 떼면 돌아온다', async () => {
    await render(
      <ConfirmedRow
        item={confirmed}
        dayLabel="오늘 · 12. 15. (화)"
        onPress={jest.fn()}
      />,
    );

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
        dayLabel="12. 20. (일)"
        onAccept={jest.fn()}
        onReject={jest.fn()}
        onOpen={jest.fn()}
      />,
    );

  // Figma 3754:6846: 흰 카드, 모서리 16, 사방 20, 윗부분(줄 사이 6) → 12 → 버튼 줄(사이 10), 아래만 Gray50 선.
  // 누르는 본문이 눌림 배경을 카드 위·옆 끝까지 칠하도록 여백을 본문·버튼 줄이 나눠 갖는다 (#102)
  it('흰 카드에 모서리 16, 본문 위·옆 20·아래 12, 버튼 줄 옆·아래 20·사이 10 이다', async () => {
    await renderCard();

    const body = screen.getByRole('button', {
      name: /^에어컨 필터 교체 상세,/,
    });
    const actions = screen.getByRole('button', {
      name: '에어컨 필터 교체 수락',
    }).parent as HostElement;
    const card = body.parent as HostElement;
    expect(card).toHaveStyle({
      backgroundColor: colors.white[100],
      borderRadius: 16,
      overflow: 'hidden',
      borderBottomWidth: 1,
      borderBottomColor: colors.gray[50],
    });
    expect(body).toHaveStyle({
      gap: 6,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 12,
    });
    expect(actions).toHaveStyle({
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 20,
      paddingBottom: 20,
    });
  });

  it('스크린리더는 본문을 제목 상세, 시간과 날짜, 업체·고객·주소로 읽는다', async () => {
    await renderCard();

    expect(
      screen.getByRole('button', {
        name: '에어컨 필터 교체 상세, 14:00 – 15:00 12. 20. (일), 한빛 설비 정다은 · 서울 용산구 이태원로 202',
      }),
    ).toBeOnTheScreen();
  });

  // #102: 누르는 본문(상세 열기)만 회색이 되고, 거절·수락 버튼 줄은 그대로다
  it('본문을 누르고 있는 동안 본문 배경이 Gray50 이 되고 떼면 돌아온다', async () => {
    await renderCard();

    await expectPressedBackground(
      screen.getByRole('button', { name: /^에어컨 필터 교체 상세,/ }),
      pressedBackground.onWhite,
    );
  });

  // Figma CTA Type=Modal CTA, Size=M: 높이 42, Button/S. 이 카드의 인스턴스는 모서리 10 이다
  it('거절·수락은 높이 42, 모서리 10, Button/S 의 모달 CTA 다', async () => {
    await renderCard();

    for (const name of ['에어컨 필터 교체 거절', '에어컨 필터 교체 수락']) {
      expect(screen.getByRole('button', { name })).toHaveStyle({
        minHeight: 42,
        borderRadius: 10,
      });
    }
    expect(screen.getByText('수락')).toHaveStyle(fontOf('Button/S'));
    expect(screen.getByText('거절')).toHaveStyle({
      ...fontOf('Button/S'),
      color: colors.gray[700],
    });
  });
});
