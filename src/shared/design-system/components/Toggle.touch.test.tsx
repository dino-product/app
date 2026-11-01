import { render, screen } from '@testing-library/react-native';
import { expectMinTouchTarget, stylePt } from '../../testing/touchTarget';
import { Toggle } from './Toggle';

describe('Toggle 터치 영역', () => {
  it('46×26 트랙 그대로 최소 터치 영역으로 넓힌다', async () => {
    await render(
      <Toggle value accessibilityLabel="알림" onValueChange={jest.fn()} />,
    );

    const track = screen.getByRole('switch');
    expectMinTouchTarget(track, {
      width: stylePt(track, 'width'),
      height: stylePt(track, 'height'),
    });
  });
});
