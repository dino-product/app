import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { expectCenteredSingleLineInput } from '../../../shared/testing/singleLineInput';
import {
  expectMinTouchTarget,
  stylePt,
  type HostElement,
} from '../../../shared/testing/touchTarget';
import { AmountInput, LineInput } from './ReportFields';

// 완료 보고의 한 줄 입력(사용 부품·결제 금액)은 테두리 칸(View) 안에 입력이 있다.
// 입력이 칸 높이를 채워야 칸 어디를 눌러도 입력이 포커스되고, 값·플레이스홀더가 칸 세로 가운데에 온다 (#151)
describe(`완료 보고 한 줄 입력 (${Platform.OS})`, () => {
  it.each([
    {
      name: '사용 부품',
      element: (
        <LineInput
          label="사용 부품 입력"
          placeholder="사용 부품 작성"
          value=""
          onChangeText={jest.fn()}
        />
      ),
      label: '사용 부품 입력',
      variant: 'Caption/M/Regular' as const,
    },
    {
      name: '결제 금액',
      element: <AmountInput value="" onChange={jest.fn()} />,
      label: '결제 금액 입력',
      variant: 'Body/XS/Medium' as const,
    },
  ])(
    '$name 입력은 칸 높이를 채워 터치 영역이 최소 이상이고, 값을 칸 세로 가운데에 둔다',
    async ({ element, label, variant }) => {
      await render(element);

      const input = screen.getByLabelText(label);
      const box = input.parent as HostElement;
      // 가로 여백은 칸(20)이 준다. 입력에 가로 여백을 두지 않으면 Android 는 EditText 테마 여백을 넣어 글자가 안쪽으로 밀린다
      expect(input).toHaveStyle({ alignSelf: 'stretch', paddingHorizontal: 0 });
      expectMinTouchTarget(input, {
        height: stylePt(box, 'minHeight') - 2 * stylePt(box, 'borderWidth'),
      });
      expectCenteredSingleLineInput(input, variant);
    },
  );
});
