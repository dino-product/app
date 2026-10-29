import { render, screen, userEvent } from '@testing-library/react-native';
import { colors } from '../tokens/colors';
import { typography } from '../tokens/typography';
import { UnderlineTabs } from './UnderlineTabs';

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
