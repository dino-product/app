import { render, screen, userEvent } from '@testing-library/react-native';
import {
  colors,
  fonts,
  pressedBackground,
} from '../../../shared/design-system';
import { expectPressedBackground } from '../../../shared/testing/pressFeedback';
import { weeklySchedule } from '../mockData';
import { ScheduleCard } from './ScheduleCard';

// Figma 메인화면 - 시작 가능(3255:17530) 의 주간 일정 카드
const item = weeklySchedule[0];

describe('ScheduleCard', () => {
  // #102: 누르는 동안 회색 배경. 둥근 모서리(16) 안에 그린다
  it('누르고 있는 동안 카드 배경이 Gray50 이 되고 떼면 흰색으로 돌아온다', async () => {
    await render(<ScheduleCard item={item} onPress={jest.fn()} />);

    const card = screen.getByRole('button', { name: /세탁기 설치/ });
    expect(card).toHaveStyle({ borderRadius: 16 });
    await expectPressedBackground(card, pressedBackground.onWhite);
  });

  it('누르면 그 일정의 id 로 onPress 를 부른다', async () => {
    const onPress = jest.fn();
    await render(<ScheduleCard item={item} onPress={onPress} />);

    await userEvent.press(screen.getByRole('button', { name: /세탁기 설치/ }));

    expect(onPress).toHaveBeenCalledWith(item.id);
  });

  it('제목은 Body/S/SemiBold 다', async () => {
    await render(<ScheduleCard item={item} onPress={jest.fn()} />);

    expect(screen.getByText('세탁기 설치')).toHaveStyle({
      fontFamily: fonts.semiBold,
      fontSize: 18,
      color: colors.gray[900],
    });
  });

  it('시간과 날짜는 Caption/M/Medium 한 줄에 공백 하나를 두고, 날짜만 Gray600 이다', async () => {
    await render(<ScheduleCard item={item} onPress={jest.fn()} />);

    expect(screen.getByText('11:00 – 12:00 오늘 · 9. 19. (토)')).toHaveStyle({
      fontFamily: fonts.medium,
      fontSize: 14,
      lineHeight: 21,
      color: colors.gray[900],
    });
    expect(screen.getByText('오늘 · 9. 19. (토)')).toHaveStyle({
      fontFamily: fonts.medium,
      color: colors.gray[600],
    });
  });

  it('칩은 제목·시간 묶음 오른쪽 위에 붙는다', async () => {
    await render(<ScheduleCard item={item} onPress={jest.fn()} />);

    const summary = screen.getByText('세탁기 설치').parent;
    expect(summary).toHaveStyle({ gap: 6 });
    expect(summary).toHaveTextContent(/^세탁기 설치11:00 – 12:00/);
    const top = summary?.parent;
    expect(top).toHaveStyle({
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    });
    const chip = top?.children.at(-1);
    expect(chip).toHaveTextContent('작업전');
    expect(chip).toHaveStyle({ alignSelf: 'flex-start' });
  });

  it('회사·고객 줄은 간격 8 이고, 고객·주소는 Caption/M/Medium Gray600, 구분선은 Gray400 이다', async () => {
    await render(<ScheduleCard item={item} onPress={jest.fn()} />);

    const row = screen.getByText('한빛 설비').parent;
    expect(row).toHaveStyle({ gap: 8 });
    expect(row?.children[1]).toHaveStyle({
      width: 1,
      height: 12,
      backgroundColor: colors.gray[400],
    });
    expect(screen.getByText('정다은 · 서울 용산구 이태원로 202')).toHaveStyle({
      fontFamily: fonts.medium,
      color: colors.gray[600],
    });
  });
});
