import { render, screen, userEvent } from '@testing-library/react-native';
import { colors } from '../tokens/colors';
import { typography } from '../tokens/typography';
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

  // 한 줄 입력의 세로 가운데 규칙(singleLineInputText, #151)은 여러 줄 입력에 쓰지 않는다
  it('여러 줄이라 줄 높이·여백 16·위쪽 정렬을 그대로 둔다', async () => {
    await render(
      <TextArea
        label="수행 메모 입력"
        placeholder="수행 메모 작성"
        value=""
        onChangeText={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('수행 메모 입력')).toHaveStyle({
      ...typography['Caption/M/Regular'],
      padding: 16,
      textAlignVertical: 'top',
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

  it('maxLength 를 주면 그 길이까지만 입력받는다', async () => {
    await render(
      <TextArea
        label="메모"
        placeholder=""
        value=""
        onChangeText={jest.fn()}
        maxLength={200}
      />,
    );

    expect(screen.getByLabelText('메모')).toHaveProp('maxLength', 200);
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

  it('readOnly 면 값은 보이고 고칠 수 없다', async () => {
    await render(
      <TextArea
        label="메모"
        placeholder=""
        value="배관 교체"
        onChangeText={jest.fn()}
        readOnly
      />,
    );

    const input = screen.getByLabelText('메모');
    expect(input).toHaveDisplayValue('배관 교체');
    expect(input).toHaveProp('editable', false);
  });
});
