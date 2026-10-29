import { render, screen, userEvent } from '@testing-library/react-native';
import { PhotoUploader } from './PhotoUploader';

describe('PhotoUploader', () => {
  it('제목과 "현재/최대" 장수를 보여준다', async () => {
    await render(
      <PhotoUploader
        title="작업 전"
        photos={['p1']}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.getByText('작업 전')).toBeOnTheScreen();
    expect(screen.getByText('1/5')).toBeOnTheScreen();
  });

  it('추가 타일을 누르면 onAdd 를 호출한다', async () => {
    const onAdd = jest.fn();
    await render(
      <PhotoUploader
        title="작업 전"
        photos={[]}
        onAdd={onAdd}
        onRemove={jest.fn()}
      />,
    );

    await userEvent.press(
      screen.getByRole('button', { name: '작업 전 사진 추가' }),
    );

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('사진의 삭제 버튼을 누르면 그 위치로 onRemove 를 호출한다', async () => {
    const onRemove = jest.fn();
    await render(
      <PhotoUploader
        title="작업 후"
        photos={['p1', 'p2']}
        onAdd={jest.fn()}
        onRemove={onRemove}
      />,
    );

    await userEvent.press(
      screen.getByRole('button', { name: '작업 후 사진 2 삭제' }),
    );

    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('최대 장수에 도달하면 추가 타일을 비활성화한다', async () => {
    const onAdd = jest.fn();
    await render(
      <PhotoUploader
        title="작업 전"
        photos={['1', '2', '3', '4', '5']}
        onAdd={onAdd}
        onRemove={jest.fn()}
      />,
    );

    const add = screen.getByRole('button', { name: '작업 전 사진 추가' });
    await userEvent.press(add);

    expect(add).toBeDisabled();
    expect(onAdd).not.toHaveBeenCalled();
  });
});
