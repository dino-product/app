import { render, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors } from '../tokens/colors';
import { typography } from '../tokens/typography';
import { UNDERLINE_TABS_HEIGHT, UnderlineTabs } from './UnderlineTabs';

const items = [
  { key: 'confirmed', label: '확정 일정', count: 2 },
  { key: 'pending', label: '응답 필요', count: 7 },
];

describe('UnderlineTabs', () => {
  it('"라벨 N건" 이름의 탭을 그리고 선택 상태를 노출한다', async () => {
    await render(
      <UnderlineTabs
        items={items}
        selectedKey="confirmed"
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('tab', { name: '확정 일정 2건' })).toBeSelected();
    expect(
      screen.getByRole('tab', { name: '응답 필요 7건' }),
    ).not.toBeSelected();
  });

  it('선택된 탭은 Primary 라벨·Accepted/1 건수, 나머지는 Gray500 이다', async () => {
    await render(
      <UnderlineTabs
        items={items}
        selectedKey="confirmed"
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByText('확정 일정')).toHaveStyle({
      ...typography['Body/XS/SemiBold'],
      color: colors.primary,
    });
    expect(screen.getByText('2')).toHaveStyle({ color: colors.accepted[1] });
    expect(screen.getByText('응답 필요')).toHaveStyle({
      color: colors.gray[500],
    });
    expect(screen.getByText('7')).toHaveStyle({ color: colors.gray[500] });
  });

  // Figma 내 일정 › 확정 일정 (2714:12918) 의 Underline Tabs (#77)
  it('건수는 Caption/M/Medium 으로 라벨과 6, 밑줄은 라벨에서 12 떨어지고, 탭 사이 24, 아래 선은 Gray200 이다', async () => {
    await render(
      <UnderlineTabs
        items={items}
        selectedKey="confirmed"
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByText('2')).toHaveStyle({
      fontFamily: typography['Caption/M/Medium'].fontFamily,
      fontSize: typography['Caption/M/Medium'].fontSize,
    });
    expect(screen.getByText('확정 일정').parent).toHaveStyle({ gap: 6 });
    const tab = screen.getByRole('tab', { name: '확정 일정 2건' });
    expect(tab).toHaveStyle({ gap: 12 });
    // 탭 목록은 접근성 요소가 아니라 역할로 찾지 않는다. 탭 사이는 확정 일정 프레임의 24 다
    expect(tab.parent).toHaveStyle({
      gap: 24,
      borderBottomColor: colors.gray[200],
    });
  });

  // 겹쳐 그리는 머리(내 일정, #148)가 처음 그릴 때 내용 위 여백으로 쓴다
  it('기본 글자 크기의 높이는 탭 위 여백 + 라벨 한 줄 + 밑줄까지 간격 + 밑줄 + 아래 선이다', async () => {
    await render(
      <UnderlineTabs
        items={items}
        selectedKey="confirmed"
        onChange={jest.fn()}
      />,
    );

    const tab = screen.getByRole('tab', { name: '확정 일정 2건' });
    const tabStyle = StyleSheet.flatten(tab.props.style);
    const indicator = StyleSheet.flatten(
      screen.getByTestId('underline-tabs-indicator-confirmed').props.style,
    );
    const list = StyleSheet.flatten(tab.parent?.props.style);
    expect(UNDERLINE_TABS_HEIGHT).toBe(
      Number(tabStyle.paddingTop) +
        typography['Body/XS/SemiBold'].lineHeight +
        Number(tabStyle.gap) +
        Number(indicator.height) +
        Number(list.borderBottomWidth),
    );
  });

  it('선택된 탭에만 밑줄을 칠한다', async () => {
    await render(
      <UnderlineTabs
        items={items}
        selectedKey="pending"
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('underline-tabs-indicator-pending')).toHaveStyle({
      backgroundColor: colors.primary,
      height: 2,
    });
    expect(
      screen.getByTestId('underline-tabs-indicator-confirmed'),
    ).toHaveStyle({
      backgroundColor: 'transparent',
    });
  });

  it('탭을 누르면 그 key 로 onChange 를 호출한다', async () => {
    const onChange = jest.fn();
    await render(
      <UnderlineTabs
        items={items}
        selectedKey="confirmed"
        onChange={onChange}
      />,
    );

    await userEvent.press(screen.getByRole('tab', { name: '응답 필요 7건' }));

    expect(onChange).toHaveBeenCalledWith('pending');
  });
});
