import { fireEvent, render, screen } from '@testing-library/react-native';
import { colors } from '../../../shared/design-system';
import { PhotoThumb, THUMB_SIZE } from './PhotoThumb';

const thumb = () => screen.getByTestId('photo-thumb');

describe('PhotoThumb', () => {
  it('붙인 사진은 그 파일을 썸네일 크기로 그린다', async () => {
    await render(<PhotoThumb uri="file:///tmp/a.jpg" />);

    expect(thumb()).toHaveProp('source', { uri: 'file:///tmp/a.jpg' });
    expect(thumb()).toHaveStyle({ width: THUMB_SIZE, height: THUMB_SIZE });
  });

  it('목 데이터(mock://)는 회색 자리로 그린다', async () => {
    await render(<PhotoThumb uri="mock://photo-1" />);

    expect(thumb()).not.toHaveProp('source');
    expect(thumb()).toHaveStyle({ backgroundColor: colors.gray[200] });
  });

  // 이어 쓰기(#34)로 복원한 사진의 임시 파일을 OS 가 지운 경우 등
  it('열리지 않는 사진은 회색 자리로 바꾼다', async () => {
    await render(<PhotoThumb uri="file:///tmp/gone.jpg" />);

    await fireEvent(thumb(), 'error', { nativeEvent: { error: 'not found' } });

    expect(thumb()).not.toHaveProp('source');
    expect(thumb()).toHaveStyle({
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      backgroundColor: colors.gray[200],
    });
  });

  it('열리지 않던 자리에 다른 사진이 오면 다시 이미지로 그린다', async () => {
    await render(<PhotoThumb uri="file:///tmp/gone.jpg" />);
    await fireEvent(thumb(), 'error', { nativeEvent: { error: 'not found' } });

    await screen.rerender(<PhotoThumb uri="file:///tmp/b.jpg" />);

    expect(thumb()).toHaveProp('source', { uri: 'file:///tmp/b.jpg' });
  });
});
