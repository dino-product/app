import { render, screen } from '@testing-library/react-native';
import { expectMinTouchTarget } from '../../testing/touchTarget';
import { Radio } from './Radio';

describe('Radio 터치 영역', () => {
  it('라디오 원(24)은 Figma 크기 그대로 두고 위아래를 최소 터치 영역으로 넓힌다', async () => {
    await render(<Radio label="동의합니다" checked onPress={jest.fn()} />);

    // 줄 높이는 원(24)이 정한다. 폭은 원 + 라벨이라 최소 터치 영역보다 넓다
    expectMinTouchTarget(screen.getByRole('radio'), { height: 24 });
  });
});
