import { Platform } from 'react-native';
import { singleLineInputText } from './singleLineInput';
import { typography } from './typography';

// 한 줄 입력칸은 hitSlop 으로 넓힐 수 없어 보이는 칸이 곧 터치 영역이고, 값·플레이스홀더가 그 칸 세로 가운데에 와야 한다.
// 가운데에 두는 규칙이 플랫폼마다 달라 *.touch.test 로 iOS(npm test)·Android(npm run test:android) 둘 다로 돈다 (#151)
describe(`한 줄 입력 글자 스타일 (${Platform.OS})`, () => {
  it.each(['Body/XS/Medium', 'Caption/M/Regular'] as const)(
    '%s: 글꼴·크기·자간은 토큰 그대로, 줄 높이 없이 세로 여백 0 이다',
    variant => {
      const { fontFamily, fontSize, letterSpacing } = typography[variant];

      // 칸 높이는 입력의 height·minHeight(Figma 값)로 정하고, 글자는 네이티브가 그 안 가운데에 그린다.
      // iOS 는 줄 높이를 주면 늘어난 만큼이 글자 위에 붙어 글자가 가운데에서 아래로 내려간다
      expect(singleLineInputText(variant)).toEqual(
        expect.objectContaining({
          fontFamily,
          fontSize,
          letterSpacing,
          paddingVertical: 0,
        }),
      );
      expect(singleLineInputText(variant)).not.toHaveProperty('lineHeight');
    },
  );

  it(
    Platform.OS === 'android'
      ? 'Android 는 글꼴 위아래 여백을 빼고 세로 가운데 정렬을 명시한다'
      : 'iOS 는 Android 전용 정렬 값을 넣지 않는다',
    () => {
      const { fontFamily, fontSize, letterSpacing } =
        typography['Body/XS/Medium'];

      expect(singleLineInputText('Body/XS/Medium')).toEqual({
        fontFamily,
        fontSize,
        letterSpacing,
        paddingVertical: 0,
        ...Platform.select({
          android: { includeFontPadding: false, textAlignVertical: 'center' },
          default: {},
        }),
      });
    },
  );
});
