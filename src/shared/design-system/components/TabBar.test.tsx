import { render, screen, userEvent } from '@testing-library/react-native';
import { colors } from '../tokens/colors';
import { typography } from '../tokens/typography';
import { TabBar } from './TabBar';

const items = [
  { key: 'all', label: '전체', count: 4 },
  { key: 'waiting', label: '수락대기', count: 2 },
  { key: 'done', label: '작업완료' },
];

describe('TabBar', () => {
  it('항목마다 탭을 그리고 "라벨 N건" 이름과 선택 상태를 노출한다', async () => {
    await render(
      <TabBar items={items} selectedKey="all" onChange={jest.fn()} />,
    );

    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: '전체 4건' })).toBeSelected();
    expect(
      screen.getByRole('tab', { name: '수락대기 2건' }),
    ).not.toBeSelected();
  });

  it('선택된 탭은 검정, 나머지는 Gray700 라벨이다', async () => {
    await render(
      <TabBar items={items} selectedKey="all" onChange={jest.fn()} />,
    );

    expect(screen.getByText('전체')).toHaveStyle({
      ...typography['Body/M/Medium'],
      color: colors.black,
    });
    expect(screen.getByText('수락대기')).toHaveStyle({
      color: colors.gray[700],
    });
  });

  it('건수가 있으면 Accepted/1 색으로 보여주고, 없으면 라벨만 그린다', async () => {
    await render(
      <TabBar items={items} selectedKey="all" onChange={jest.fn()} />,
    );

    expect(screen.getByText('4')).toHaveStyle({
      ...typography['Body/XS/Medium'],
      color: colors.accepted[1],
    });
    expect(screen.getByRole('tab', { name: '작업완료' })).toBeOnTheScreen();
  });

  it('선택된 탭에만 밑줄을 칠한다', async () => {
    await render(
      <TabBar items={items} selectedKey="all" onChange={jest.fn()} />,
    );

    expect(screen.getByTestId('tab-bar-indicator-all')).toHaveStyle({
      backgroundColor: colors.accepted[1],
      height: 3,
    });
    expect(screen.getByTestId('tab-bar-indicator-waiting')).toHaveStyle({
      backgroundColor: 'transparent',
    });
  });

  it('탭을 누르면 그 key 로 onChange 를 호출한다', async () => {
    const onChange = jest.fn();
    await render(
      <TabBar items={items} selectedKey="all" onChange={onChange} />,
    );

    await userEvent.press(screen.getByRole('tab', { name: '작업완료' }));

    expect(onChange).toHaveBeenCalledWith('done');
  });
});
