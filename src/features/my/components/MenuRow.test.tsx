import { render, screen, userEvent } from '@testing-library/react-native';
import { colors, pressedBackground } from '../../../shared/design-system';
import { pressIn } from '../../../shared/testing/press';
import { expectPressedBackground } from '../../../shared/testing/pressFeedback';
import { MenuRow } from './MenuRow';

describe('MenuRow', () => {
  it('누르면 onPress 를 부른다', async () => {
    const onPress = jest.fn();
    await render(<MenuRow label="계정 관리" onPress={onPress} />);

    await userEvent.press(screen.getByRole('button', { name: '계정 관리' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // #102: 회색 채움 행이라 눌림은 한 단계 진한 회색이다. 흐리게(opacity) 하지 않고, 둥근 모서리(16) 안에 칠한다
  it('누르고 있는 동안 배경이 Gray100 이 되고 떼면 돌아온다', async () => {
    await render(<MenuRow label="계정 관리" onPress={jest.fn()} />);

    const row = screen.getByRole('button', { name: '계정 관리' });
    expect(row).toHaveStyle({
      borderRadius: 16,
      backgroundColor: colors.background[3],
    });
    await expectPressedBackground(row, pressedBackground.onGray);
  });

  it('누르는 동안 흐려지지 않는다', async () => {
    await render(<MenuRow label="계정 관리" onPress={jest.fn()} />);

    const row = screen.getByRole('button', { name: '계정 관리' });
    await pressIn(row);

    expect(row).not.toHaveStyle({ opacity: 0.8 });
  });
});
