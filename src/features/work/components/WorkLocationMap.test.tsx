import { act, render, screen, userEvent } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { colors } from '../../../shared/design-system';
import { MAP_ZOOM_LEVEL, WorkLocationMap } from './WorkLocationMap';

const site = { latitude: 37.500622, longitude: 127.036456 };

const renderMap = (location: typeof site | null = site, onPress = jest.fn()) =>
  render(<WorkLocationMap location={location} onPress={onPress} />);

// 네이티브 지도 뷰(KakaoMapView)는 테스트 렌더러에서 호스트 컴포넌트로만 그려진다.
// 지도·회색 자리는 스크린리더에서 숨기므로 숨긴 요소까지 찾는다
const hidden = { includeHiddenElements: true };
const nativeMap = () => screen.getByTestId('work-location-native-map', hidden);
const queryNativeMap = () =>
  screen.queryByTestId('work-location-native-map', hidden);
const placeholder = () =>
  screen.queryByTestId('work-location-map-placeholder', hidden);

describe('WorkLocationMap', () => {
  it('좌표가 있으면 카카오맵 지도 뷰에 그 좌표와 줌 상수를 넘긴다', async () => {
    await renderMap();

    expect(nativeMap().type).toBe('KakaoMapView');
    expect(nativeMap().props).toMatchObject({
      latitude: 37.500622,
      longitude: 127.036456,
      zoomLevel: MAP_ZOOM_LEVEL,
    });
  });

  // 현장 주변 1–2블록과 도로 이름이 보이는 정도. 실기기에서 맞추되 상수 하나로 둔다
  it('줌 레벨 상수는 SDK v2 기준 16 에서 시작한다', () => {
    expect(MAP_ZOOM_LEVEL).toBe(16);
  });

  // Figma 작업 위치 지도 (작업 상세 3235:16283, 응답 필요 3463:16691): 카드 폭 그대로, 높이 202, 모서리 10
  describe('지도 자리는 Figma 대로 높이 202, 모서리 10 이다', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const frame = () =>
      screen.getByRole('imagebutton', { name: '작업 위치 지도' });

    it('iOS 는 지도를 둥근 모서리로 자른다', async () => {
      await renderMap();

      expect(frame()).toHaveStyle({
        height: 202,
        borderRadius: 10,
        overflow: 'hidden',
      });
    });

    // Android 지도는 SurfaceView 라 부모 자르기가 먹지 않아 네이티브가 귀퉁이를 카드 배경으로 덮는다.
    // 부모가 자르면 그 덮개까지 잘려 나가므로 Android 에서는 자르지 않는다
    it('Android 는 부모가 자르지 않고 네이티브가 모서리 10 만큼 귀퉁이를 덮는다', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      await renderMap();

      expect(frame()).toHaveStyle({ height: 202, borderRadius: 10 });
      expect(StyleSheet.flatten(frame().props.style).overflow).not.toBe(
        'hidden',
      );
      expect(nativeMap().props).toMatchObject({
        cornerRadius: 10,
        cornerMaskColor: colors.white[100],
      });
    });
  });

  it('좌표가 없으면 지도 없이 같은 크기의 회색 자리만 그린다', async () => {
    await renderMap(null);

    expect(queryNativeMap()).toBeNull();
    expect(placeholder()).toHaveStyle({
      height: 202,
      borderRadius: 10,
      backgroundColor: colors.background[1],
    });
  });

  it('지도를 불러오는 동안은 회색 자리로 덮고, 다 불러오면 지도를 보여 준다', async () => {
    await renderMap();

    // 지도 위를 꽉 채워 덮는다 (지도 자리 크기·모서리는 그대로. 부모가 자르지 않는 Android 에서도 둥글다)
    expect(placeholder()).toHaveStyle({
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 10,
      backgroundColor: colors.background[1],
    });

    await act(() => nativeMap().props.onMapReady({ nativeEvent: {} }));

    expect(placeholder()).toBeNull();
    expect(nativeMap()).toBeOnTheScreen();
  });

  // 키·플랫폼 인증 실패, 네트워크 오류, 엔진 오류
  it('지도를 그리지 못하면 지도 뷰를 내리고 회색 자리를 남긴다 (높이는 그대로)', async () => {
    await renderMap();

    await act(() =>
      nativeMap().props.onMapError({ nativeEvent: { code: 401 } }),
    );

    expect(queryNativeMap()).toBeNull();
    expect(placeholder()).toBeOnTheScreen();
    expect(
      screen.getByRole('imagebutton', { name: '작업 위치 지도' }),
    ).toHaveStyle({ height: 202 });
  });

  // 지도는 움직이지 않는 표시용: 이동·확대·회전 제스처는 네이티브에서 끄고(설정 테스트 kakao-map-native-config),
  // 터치도 지도 뷰로 보내지 않아 지도 위에서 끌어도 화면이 세로로 스크롤되고 누르기는 바깥 Pressable 이 받는다
  it('지도 뷰는 터치를 받지 않는다', async () => {
    await renderMap();

    expect(nativeMap().props.pointerEvents).toBe('none');
  });

  // Android 지도는 SurfaceView 라 부모의 둥근 자르기가 먹지 않아, 네이티브가 귀퉁이를 카드 배경색으로 덮는다
  it('지도 귀퉁이를 카드 배경(흰색)으로 모서리 10 만큼 덮게 넘긴다', async () => {
    await renderMap();

    expect(nativeMap().props).toMatchObject({
      cornerRadius: 10,
      cornerMaskColor: colors.white[100],
    });
  });

  it('지도를 누르면 카카오맵 열기를 부른다', async () => {
    const onPress = jest.fn();
    await renderMap(site, onPress);

    await userEvent.press(
      screen.getByRole('imagebutton', { name: '작업 위치 지도' }),
    );

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  describe('접근성', () => {
    it("스크린리더는 지도를 '작업 위치 지도' 이미지 버튼 하나로 읽는다", async () => {
      await renderMap();

      const map = screen.getByRole('imagebutton', { name: '작업 위치 지도' });
      expect(map.props.accessibilityHint).toBe('카카오맵에서 위치를 엽니다');
      // 네이티브 지도 안쪽(마커·로고)은 따로 읽지 않는다
      expect(nativeMap().props.importantForAccessibility).toBe(
        'no-hide-descendants',
      );
      expect(nativeMap().props.accessibilityElementsHidden).toBe(true);
    });

    it('좌표가 없는 회색 자리는 건너뛴다', async () => {
      await renderMap(null);

      expect(screen.queryByRole('imagebutton')).toBeNull();
      expect(placeholder()!.props.importantForAccessibility).toBe(
        'no-hide-descendants',
      );
      expect(placeholder()!.props.accessibilityElementsHidden).toBe(true);
    });
  });
});
