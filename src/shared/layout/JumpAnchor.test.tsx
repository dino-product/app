import { render, screen } from '@testing-library/react-native';
import { JumpAnchor } from './JumpAnchor';

// 바로가기 버튼(JumpAnchor). 작업 상세 '완료 보고 작성하기' 의 모양·애니메이션은 WorkDetailScreen.test 가 본다.
// 여기서는 하단 탭 바 없이 열리는 화면(가입 약관 상세, #218)이 아래 안전 영역을 비켜 두는 것을 본다
describe('JumpAnchor', () => {
  const fade = () =>
    screen.getByTestId('jump-fade', { includeHiddenElements: true });
  const jump = () =>
    screen.getByTestId('jump', { includeHiddenElements: true });

  it('아이콘은 Figma 대로 24 다', async () => {
    await render(
      <JumpAnchor label="이동" visible onPress={jest.fn()} testID="jump" />,
    );

    expect(
      screen.getByTestId('jump-icon', { includeHiddenElements: true }),
    ).toHaveStyle({ width: 24, height: 24 });
  });

  it('글자와 스크린리더 이름을 받는다', async () => {
    await render(
      <JumpAnchor
        label="약관 동의하기"
        accessibilityLabel="서비스 이용약관 동의하기"
        visible
        onPress={jest.fn()}
        testID="jump"
      />,
    );

    expect(
      screen.getByRole('button', { name: '서비스 이용약관 동의하기' }),
    ).toHaveTextContent('약관 동의하기');
  });

  // Figma 작업수행-상세: 버튼(2741:3444)은 탭 바 위 24, 아이콘 charm:chevrons-down(2741:3450)은 24×24
  it('아래 안전 영역이 없으면 버튼은 아래 24, 그라데이션은 218 이다 (작업 상세와 같다)', async () => {
    await render(
      <JumpAnchor label="이동" visible onPress={jest.fn()} testID="jump" />,
    );

    expect(jump()).toHaveStyle({ bottom: 24 });
    expect(fade()).toHaveStyle({
      height: 218,
      backgroundImage:
        'linear-gradient(to bottom, rgba(240, 240, 240, 0) 8.96%, rgba(240, 240, 240, 1) 83.84%)',
    });
  });

  // 그라데이션 모양(위에서 잰 투명 구간 끝 19.5 · 불투명 시작 182.8)은 그대로 두고, 안전 영역만큼 아래를 불투명으로 늘린다
  it('아래 안전 영역이 있으면 버튼을 그만큼 올리고 그라데이션을 안전 영역 끝까지 늘린다', async () => {
    await render(
      <JumpAnchor
        label="이동"
        visible
        onPress={jest.fn()}
        bottomInset={34}
        testID="jump"
      />,
    );

    expect(jump()).toHaveStyle({ bottom: 24 + 34 });
    expect(fade()).toHaveStyle({
      height: 218 + 34,
      backgroundImage:
        'linear-gradient(to bottom, rgba(240, 240, 240, 0) 7.75%, rgba(240, 240, 240, 1) 72.53%)',
    });
  });

  it('숨은 자리는 늘린 그라데이션 높이만큼 아래다 (나타날 때 거기서 올라온다)', async () => {
    await render(
      <JumpAnchor
        label="이동"
        visible={false}
        onPress={jest.fn()}
        bottomInset={34}
        testID="jump"
      />,
    );
    await screen.rerender(
      <JumpAnchor
        label="이동"
        visible
        onPress={jest.fn()}
        bottomInset={34}
        testID="jump"
      />,
    );

    // 네이티브 드라이버 애니메이션은 테스트에서 돌지 않아 시작 자리에 머문다
    expect(jump()).toHaveStyle({ transform: [{ translateY: 252 }] });
  });

  // 안전 영역은 화면이 뜬 뒤에 늦게 잡힐 수 있다. 숨어 있는 동안 바뀌면 새 자리에서 올라온다
  it('숨어 있는 동안 아래 거리가 바뀌면 새 숨은 자리에서 올라온다', async () => {
    const anchor = (visible: boolean, bottomInset: number) => (
      <JumpAnchor
        label="이동"
        visible={visible}
        onPress={jest.fn()}
        bottomInset={bottomInset}
        testID="jump"
      />
    );
    await render(anchor(false, 0));
    await screen.rerender(anchor(false, 34));

    await screen.rerender(anchor(true, 34));

    expect(jump()).toHaveStyle({ transform: [{ translateY: 252 }] });
  });
});
