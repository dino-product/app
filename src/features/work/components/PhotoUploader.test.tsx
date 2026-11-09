import {
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors, typography } from '../../../shared/design-system';
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
    expect(screen.getByText('1/6')).toBeOnTheScreen();
  });

  // #180: Figma 작업수행-상세/보고제출 활성(3235:16226·3235:15926) 의 '작업 전'·'작업 후' 묶음은 카드 없이
  // 이름(Caption/M/Medium Gray600) 아래 8 에 사진 줄이 온다
  it('카드 없이 이름 아래 8 에 사진 줄을 두고, 이름은 Caption/M/Medium Gray600 이다', async () => {
    await render(
      <PhotoUploader
        title="작업 전"
        photos={['p1']}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    const title = screen.getByText('작업 전');
    expect(title).toHaveStyle({
      ...typography['Caption/M/Medium'],
      color: colors.gray[600],
    });
    const group = title.parent;
    expect(group).toHaveStyle({ gap: 8 });
    const style = StyleSheet.flatten(group?.props.style);
    expect(style.borderWidth ?? 0).toBe(0);
    expect(style.padding ?? 0).toBe(0);
    expect(style.backgroundColor).toBeUndefined();
  });

  // Figma 3235:16332: 사진 줄은 가로로 넘쳐(565) 옆으로 밀어 보고, 칸 사이 10, 칸은 105×105 모서리 8 이다
  it('사진 줄은 가로 스크롤이고 칸은 105×105·모서리 8, 사이 10 이다', async () => {
    await render(
      <PhotoUploader
        title="작업 전"
        photos={['p1', 'p2']}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    const row = screen.getByTestId('photo-row-작업 전');
    expect(row).toHaveProp('horizontal', true);
    expect(row).toHaveProp('showsHorizontalScrollIndicator', false);
    expect(StyleSheet.flatten(row.props.contentContainerStyle)).toMatchObject({
      gap: 10,
    });
    expect(
      screen.getByRole('button', { name: '작업 전 사진 추가' }),
    ).toHaveStyle({ width: 105, height: 105, borderRadius: 8 });
    for (const thumb of screen.getAllByTestId('photo-thumb')) {
      expect(thumb).toHaveStyle({ width: 105, height: 105, borderRadius: 8 });
    }
  });

  // Figma 3235:16336: 카메라 30 (Gray400) 아래 1 에 장수 Caption/S/Medium Gray600
  it('추가 칸은 카메라 30·Gray400 아래 1 에 장수를 Caption/S/Medium Gray600 으로 보인다', async () => {
    await render(
      <PhotoUploader
        title="작업 전"
        photos={[]}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    const add = screen.getByRole('button', { name: '작업 전 사진 추가' });
    expect(add).toHaveStyle({ gap: 1 });
    const icon = within(add).getByTestId('add-photo-icon', {
      includeHiddenElements: true,
    });
    expect(icon).toHaveStyle({ width: 30, height: 30 });
    const [svg] = icon.children;
    expect(typeof svg === 'string' ? svg : svg.props.color).toBe(
      colors.gray[400],
    );
    expect(screen.getByText('0/6')).toHaveStyle({
      ...typography['Caption/S/Medium'],
      color: colors.gray[600],
    });
  });

  // Figma 3235:16353: 지우기 x(24) 는 칸 위·오른쪽 7 에 있다
  it('사진의 지우기 버튼은 칸 위 7·오른쪽 7 에 있다', async () => {
    await render(
      <PhotoUploader
        title="작업 전"
        photos={['p1']}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: '작업 전 사진 1 삭제' }),
    ).toHaveStyle({ position: 'absolute', top: 7, right: 7 });
  });

  it('추가 칸은 회색 채움이고 테두리가 없다', async () => {
    await render(
      <PhotoUploader
        title="작업 전"
        photos={[]}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    const add = screen.getByRole('button', { name: '작업 전 사진 추가' });
    expect(add).toHaveStyle({ backgroundColor: colors.gray[50] });
    expect(StyleSheet.flatten(add.props.style).borderWidth ?? 0).toBe(0);
    expect(screen.getByText('0/6')).toBeOnTheScreen();
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
        photos={['1', '2', '3', '4', '5', '6']}
        onAdd={onAdd}
        onRemove={jest.fn()}
      />,
    );

    const add = screen.getByRole('button', { name: '작업 전 사진 추가' });
    await userEvent.press(add);

    expect(add).toBeDisabled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  // 제출을 마친 보고. 추가 칸·삭제 버튼을 숨길지는 디자이너 확인 전이라 Figma 대로 두고 누를 수만 없게 한다
  it('readOnly 면 추가·삭제를 막는다', async () => {
    const onAdd = jest.fn();
    const onRemove = jest.fn();
    await render(
      <PhotoUploader
        title="작업 전"
        photos={['p1']}
        onAdd={onAdd}
        onRemove={onRemove}
        readOnly
      />,
    );

    const add = screen.getByRole('button', { name: '작업 전 사진 추가' });
    const remove = screen.getByRole('button', { name: '작업 전 사진 1 삭제' });
    await userEvent.press(add);
    await userEvent.press(remove);

    expect(add).toBeDisabled();
    expect(remove).toBeDisabled();
    expect(onAdd).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByText('1/6')).toBeOnTheScreen();
  });
});
