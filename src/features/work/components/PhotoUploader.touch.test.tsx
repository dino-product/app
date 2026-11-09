import { render, screen } from '@testing-library/react-native';
import {
  expectIconButtonTouchTarget,
  hitSlopOf,
  stylePt,
} from '../../../shared/testing/touchTarget';
import { PhotoUploader } from './PhotoUploader';

describe('PhotoUploader 터치 영역', () => {
  it('사진 지우기 버튼은 24 아이콘 그대로 최소 터치 영역으로 넓힌다', async () => {
    await render(
      <PhotoUploader
        title="작업 전"
        photos={['p1']}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expectIconButtonTouchTarget(
      screen.getByRole('button', { name: '작업 전 사진 1 삭제' }),
    );
  });

  // #180: 사진 줄이 가로 스크롤이라 줄 밖으로 넓힌 영역은 잘려 누를 수 없다.
  // 버튼은 칸 위·오른쪽 7 에 있으니 그쪽으로는 7 까지만 넓히고 나머지는 칸 안쪽(왼쪽·아래)으로 넓힌다
  it('사진 지우기 버튼이 넓힌 영역은 사진 칸(105) 안에 든다', async () => {
    await render(
      <PhotoUploader
        title="작업 전"
        photos={['p1']}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    const remove = screen.getByRole('button', { name: '작업 전 사진 1 삭제' });
    const slop = hitSlopOf(remove);
    expect(slop.top).toBeLessThanOrEqual(stylePt(remove, 'top'));
    expect(slop.right).toBeLessThanOrEqual(stylePt(remove, 'right'));
    const thumb = screen.getByTestId('photo-thumb');
    const tile = stylePt(thumb, 'width');
    const size = 24;
    expect(stylePt(remove, 'right') + size + slop.left).toBeLessThanOrEqual(
      tile,
    );
    expect(stylePt(remove, 'top') + size + slop.bottom).toBeLessThanOrEqual(
      tile,
    );
  });
});
