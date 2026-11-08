import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { expectCenteredSingleLineInput } from '../../../shared/testing/singleLineInput';
import {
  expectMinTouchTarget,
  stylePt,
} from '../../../shared/testing/touchTarget';
import { FormField } from './FormField';

// 입력칸은 hitSlop 으로 넓힐 수 없어 보이는 칸이 터치 영역이고, 값·플레이스홀더는 그 칸 세로 가운데에 온다 (#151).
// 마이 › 프로필 수정과 온보딩 › 프로필 등록이 같이 쓴다
describe(`FormField 입력칸 (${Platform.OS})`, () => {
  it('Figma 높이 50 칸이 최소 터치 영역 이상이고, 값을 그 칸 세로 가운데에 둔다', async () => {
    await render(
      <FormField
        label="이름"
        value="박기사"
        onChangeText={jest.fn()}
        placeholder="이름을 입력해 주세요"
      />,
    );

    const input = screen.getByLabelText('이름');
    expect(input).toHaveStyle({ minHeight: 50, paddingHorizontal: 16 });
    expectMinTouchTarget(input, { height: stylePt(input, 'minHeight') });
    expectCenteredSingleLineInput(input, 'Body/XS/Medium');
  });
});
