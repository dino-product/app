import { render, screen, userEvent } from '@testing-library/react-native';
import { colors } from '../tokens/colors';
import { typography } from '../tokens/typography';
import { TypeTabs } from './TypeTabs';

const items = [
  { key: 'employee', label: '직원유형' },
  { key: 'driver', label: '기사유형' },
  { key: 'work', label: '작업유형' },
];

describe('TypeTabs', () => {
  it('선택된 탭은 Gray50 배경과 Primary 라벨이다', async () => {
    await render(
      <TypeTabs items={items} selectedKey="employee" onChange={jest.fn()} />,
    );

    const selected = screen.getByRole('tab', { name: '직원유형' });
    expect(selected).toBeSelected();
    expect(selected).toHaveStyle({
      backgroundColor: colors.gray[50],
      borderRadius: 999,
    });
    expect(screen.getByText('직원유형')).toHaveStyle({
      ...typography['Body/S/SemiBold'],
      color: colors.primary,
    });
  });

  it('선택되지 않은 탭은 배경 없이 Gray600 라벨이다', async () => {
    await render(
      <TypeTabs items={items} selectedKey="employee" onChange={jest.fn()} />,
    );

    expect(screen.getByRole('tab', { name: '기사유형' })).not.toHaveStyle({
      backgroundColor: colors.gray[50],
    });
    expect(screen.getByText('기사유형')).toHaveStyle({
      color: colors.gray[600],
    });
  });

  it('탭을 누르면 그 key 로 onChange 를 호출한다', async () => {
    const onChange = jest.fn();
    await render(
      <TypeTabs items={items} selectedKey="employee" onChange={onChange} />,
    );

    await userEvent.press(screen.getByRole('tab', { name: '작업유형' }));

    expect(onChange).toHaveBeenCalledWith('work');
  });
});
