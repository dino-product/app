import { render, screen, userEvent } from '@testing-library/react-native';
import { colors } from '../tokens/colors';
import { TextArea } from './TextArea';

describe('TextArea', () => {
  it('접근성 라벨과 placeholder 를 가진 여러 줄 입력이다', async () => {
    await render(
      <TextArea
        label="수행 메모 입력"
        placeholder="수행 메모 작성"
        value=""
        onChangeText={jest.fn()}
      />,
    );

    const input = screen.getByLabelText('수행 메모 입력');
    expect(input).toHaveProp('multiline', true);
    expect(input).toHaveProp('placeholder', '수행 메모 작성');
    expect(input).toHaveStyle({
      minHeight: 110,
      borderRadius: 12,
      borderColor: colors.gray[200],
    });
  });

  it('입력하면 onChangeText 를 호출한다', async () => {
    const onChangeText = jest.fn();
    await render(
      <TextArea
        label="메모"
        placeholder=""
        value=""
        onChangeText={onChangeText}
      />,
    );

    await userEvent.type(screen.getByLabelText('메모'), '가');

    expect(onChangeText).toHaveBeenLastCalledWith('가');
  });

  it('error 면 Warning/1 테두리다', async () => {
    await render(
      <TextArea
        label="메모"
        placeholder=""
        value=""
        onChangeText={jest.fn()}
        error
      />,
    );

    expect(screen.getByLabelText('메모')).toHaveStyle({
      borderColor: colors.warning[1],
    });
  });
});
