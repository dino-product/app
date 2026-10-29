import { render, screen, userEvent } from '@testing-library/react-native';
import { colors } from '../tokens/colors';
import { Toggle } from './Toggle';

describe('Toggle', () => {
  it('스위치 역할과 켜짐 상태를 노출한다', async () => {
    await render(
      <Toggle value accessibilityLabel="알림" onValueChange={jest.fn()} />,
    );

    expect(screen.getByRole('switch', { name: '알림' })).toBeChecked();
  });

  it('누르면 반대 값으로 onValueChange 를 호출한다', async () => {
    const onValueChange = jest.fn();
    await render(
      <Toggle
        value={false}
        accessibilityLabel="알림"
        onValueChange={onValueChange}
      />,
    );

    await userEvent.press(screen.getByRole('switch', { name: '알림' }));

    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('꺼짐은 Gray200 트랙에 노브가 왼쪽, 켜짐은 Secondary 트랙에 흰 노브가 오른쪽이다', async () => {
    const { rerender } = await render(
      <Toggle
        value={false}
        accessibilityLabel="알림"
        onValueChange={jest.fn()}
        testID="toggle"
      />,
    );
    expect(screen.getByRole('switch')).toHaveStyle({
      backgroundColor: colors.gray[200],
      width: 46,
      height: 26,
    });
    expect(screen.getByTestId('toggle-knob')).toHaveStyle({ left: 2 });

    await rerender(
      <Toggle
        value
        accessibilityLabel="알림"
        onValueChange={jest.fn()}
        testID="toggle"
      />,
    );
    expect(screen.getByRole('switch')).toHaveStyle({
      backgroundColor: colors.secondary,
    });
    expect(screen.getByTestId('toggle-knob')).toHaveStyle({
      left: 22,
      backgroundColor: colors.white[100],
    });
  });

  it('작은 트랙을 보완하도록 터치 영역을 넓힌다 (최소 44pt)', async () => {
    await render(
      <Toggle value accessibilityLabel="알림" onValueChange={jest.fn()} />,
    );

    expect(screen.getByRole('switch')).toHaveProp('hitSlop', {
      top: 9,
      bottom: 9,
      left: 0,
      right: 0,
    });
  });

  it('disabled 면 값을 바꾸지 않는다', async () => {
    const onValueChange = jest.fn();
    await render(
      <Toggle
        value={false}
        disabled
        accessibilityLabel="알림"
        onValueChange={onValueChange}
      />,
    );

    await userEvent.press(screen.getByRole('switch'));

    expect(screen.getByRole('switch')).toBeDisabled();
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
