import { render, screen, userEvent } from '@testing-library/react-native';
import { iconSvgIn } from '../../testing/icon';
import { iconSvgs } from '../icons/svgs';
import { colors } from '../tokens/colors';
import { Radio } from './Radio';

// 라디오 (DesignSystem 추가, #193). 그림은 Figma eva:radio-button-on-fill / off-outline (온보딩 역할 선택 3255:19286)
describe('Radio', () => {
  it('라벨로 읽히는 라디오이고, 고른 상태를 알린다', async () => {
    await render(<Radio label="동의합니다" checked onPress={jest.fn()} />);

    expect(screen.getByRole('radio', { name: '동의합니다' })).toBeChecked();
    expect(screen.getByText('동의합니다')).toBeOnTheScreen();
  });

  it('고르면 Secondary 로 채운 원, 아니면 Gray200 고리다', async () => {
    const { rerender } = await render(
      <Radio label="동의합니다" checked onPress={jest.fn()} />,
    );
    const svg = () => iconSvgIn(screen.getByRole('radio'));
    expect(svg().props.xml).toBe(iconSvgs['radio-on'].xml);
    expect(svg().props.color).toBe(colors.secondary);

    await rerender(
      <Radio label="동의합니다" checked={false} onPress={jest.fn()} />,
    );
    expect(screen.getByRole('radio')).not.toBeChecked();
    expect(svg().props.xml).toBe(iconSvgs['radio-off'].xml);
    expect(svg().props.color).toBe(colors.gray[200]);
  });

  it('누르면 알린다', async () => {
    const onPress = jest.fn();
    await render(
      <Radio label="동의하지 않습니다" checked={false} onPress={onPress} />,
    );

    await userEvent.press(
      screen.getByRole('radio', { name: '동의하지 않습니다' }),
    );

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
