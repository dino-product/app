import { render, screen, userEvent } from '@testing-library/react-native';
import { createRef } from 'react';
import type { TextInputInstance } from 'react-native';
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

  it('autoFocus·onFocus·ref 를 입력란에 넘긴다', async () => {
    const ref = createRef<TextInputInstance>();
    const onFocus = jest.fn();
    await render(
      <TextArea
        ref={ref}
        label="메모"
        placeholder=""
        value=""
        onChangeText={jest.fn()}
        onFocus={onFocus}
        autoFocus
      />,
    );

    const input = screen.getByLabelText('메모');
    expect(input).toHaveProp('autoFocus', true);
    // fireEvent 는 위 컴포넌트의 onFocus 까지 찾아가므로 입력란이 받았는지로 본다
    expect(input).toHaveProp('onFocus', onFocus);
    // 테스트 환경의 TextInput ref 는 목 컴포넌트 인스턴스다
    expect(ref.current).toEqual(
      expect.objectContaining({
        props: expect.objectContaining({ accessibilityLabel: '메모' }),
      }),
    );
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
