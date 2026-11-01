import { render, screen } from '@testing-library/react-native';
import { expectIconButtonTouchTarget } from '../../../shared/testing/touchTarget';
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
});
