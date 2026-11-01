import { render, screen } from '@testing-library/react-native';
import { expectMinTouchTarget, stylePt } from '../../testing/touchTarget';
import { CTA } from './CTA';

type Layout = { type: 'modal' } | { size: 'L' | 'M' };

describe('CTA 터치 영역', () => {
  // 폭은 부모를 채워 넓으므로 높이만 본다. 글자가 작을수록 minHeight 가 높이가 된다
  it.each<[string, Layout]>([
    ['Modal(42)', { type: 'modal' }],
    ['M(46)', { size: 'M' }],
    ['L(56)', { size: 'L' }],
  ])('%s 은 높이 그대로 최소 터치 영역으로 넓힌다', async (_, layout) => {
    await render(<CTA {...layout} label="확인" onPress={jest.fn()} />);

    const button = screen.getByRole('button');
    expectMinTouchTarget(button, { height: stylePt(button, 'minHeight') });
  });
});
