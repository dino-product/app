import { render, screen } from '@testing-library/react-native';
import { Pressable, StyleSheet, Text } from 'react-native';
import { pressIn, pressOut } from './press';

const styles = StyleSheet.create({
  idle: { backgroundColor: 'white' },
  pressed: { backgroundColor: 'gray' },
});

describe('press 헬퍼', () => {
  it('손가락을 대고 있는 동안만 Pressable 이 눌림 상태다', async () => {
    const onPress = jest.fn();
    await render(
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => (pressed ? styles.pressed : styles.idle)}
      >
        <Text>행</Text>
      </Pressable>,
    );
    const row = screen.getByRole('button', { name: '행' });

    await pressIn(row);
    expect(row).toHaveStyle({ backgroundColor: 'gray' });

    await pressOut(row);
    expect(row).toHaveStyle({ backgroundColor: 'white' });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
