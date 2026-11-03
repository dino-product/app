import { Platform, StyleSheet, View, type ViewProps } from 'react-native';
import { withOpacity } from '../tokens/colors';

// Figma 드롭 섀도 (spread 0)
export type DropShadow = {
  x: number;
  y: number;
  blur: number;
  /** 6자리 hex */
  color: string;
  opacity: number;
};

export type ShadowViewProps = ViewProps & { shadow: DropShadow };

// RN 은 boxShadow 를 Android 9(API 28)부터 그린다
const MIN_BOX_SHADOW_API = 28;
// 8.1 이하에서 흐림을 흉내 내는 계단 폭. 카드 그림자(blur 18, 12%)에서는 이웃 계단 차이가
// 3/255 정도라 띠가 거의 보이지 않는다. 더 좁거나 진한 그림자에 쓰면 띠가 보일 수 있다
const STEP = 2;

/**
 * boxShadow 를 그리는 View. boxShadow 를 못 그리는 Android 8.1 이하에서는 뒤에 조금씩 큰
 * 둥근 사각형을 겹쳐 같은 색·같은 감쇠로 근사한다. 그 경로에서는
 * - 바깥에 View 가 하나 더 생기므로 margin·flex·position·transform 같은 바깥 배치는 style 에 넣지 않는다.
 * - 배경은 불투명하고, borderRadius 는 네 모서리가 같은 숫자여야 한다.
 * - x·y 는 STEP(2) 이하를 기준으로 한다. 더 크면 카드 옆으로 드러나는 그림자 안쪽이 평평해진다.
 * - 카드마다 하드웨어 텍스처를 하나씩 잡으므로 리스트 항목처럼 여러 개 그리는 곳에는 쓰지 않는다.
 */
export function ShadowView({ shadow, style, ...rest }: ShadowViewProps) {
  if (!(Platform.OS === 'android' && Platform.Version < MIN_BOX_SHADOW_API)) {
    return (
      <View style={[style, { boxShadow: toBoxShadow(shadow) }]} {...rest} />
    );
  }
  const borderRadius = StyleSheet.flatten(style)?.borderRadius;
  const radius = typeof borderRadius === 'number' ? borderRadius : 0;
  const layers = shadowLayers(shadow);
  if (layers.length === 0) {
    return <View style={style} {...rest} />;
  }
  // 가장 큰 사각형이 컨테이너를 꼭 채운다. 하드웨어 텍스처는 View 경계 밖을 자른다
  const extent = layers[0].spread;
  return (
    <View>
      {/* 사각형들을 한 번 그려 텍스처로 두고, 스크롤할 때는 텍스처 한 장만 합성한다.
          사각형이 평탄화돼 컨테이너 밖으로 빠지면 텍스처가 비므로 collapsable 을 끈다 */}
      <View
        renderToHardwareTextureAndroid
        collapsable={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.layers,
          {
            top: shadow.y - extent,
            bottom: -shadow.y - extent,
            left: shadow.x - extent,
            right: -shadow.x - extent,
          },
        ]}
      >
        {layers.map(({ spread, opacity }) => (
          <View
            key={spread}
            style={[
              styles.layer,
              {
                top: extent - spread,
                bottom: extent - spread,
                left: extent - spread,
                right: extent - spread,
                borderRadius: radius + spread,
                backgroundColor: withOpacity(shadow.color, opacity),
              },
            ]}
          />
        ))}
      </View>
      <View style={style} {...rest} />
    </View>
  );
}

const styles = StyleSheet.create({
  layers: { position: 'absolute', pointerEvents: 'none' },
  layer: { position: 'absolute' },
});

function toBoxShadow({ x, y, blur, color, opacity }: DropShadow) {
  return `${x}px ${y}px ${blur}px ${withOpacity(color, opacity)}`;
}

// 기기는 색의 진하기를 1/255 단위로 반올림한다 (processColor)
const quantize = (opacity: number) => Math.round(opacity * 255) / 255;

// CSS 처럼 흐림 반경 blur 의 표준편차는 blur/2 이고, 그림자 가장자리에서 d 만큼 밖의 진하기는
// opacity·(1 − Φ(d/σ)) 다. 사각형을 STEP 씩 키워 겹칠 때, 띠마다 덮인 사각형들의 합성 진하기가
// 띠 가운데의 목표 진하기와 같도록 바깥 사각형부터 진하기를 정한다. 반올림해 0 이 되는 바깥 띠는
// 그리지 않는다. 모서리는 곧은 변의 감쇠를 그대로 써서 실제 흐림보다 조금 진하다.
// 큰 것부터 돌려준다.
function shadowLayers({ blur, opacity }: DropShadow) {
  const sigma = blur / 2;
  if (sigma === 0) {
    return quantize(opacity) > 0
      ? [{ spread: 0, opacity: quantize(opacity) }]
      : [];
  }
  const count = Math.ceil((3 * sigma) / STEP);
  // 띠 k 는 가장자리에서 ((k − 1)·STEP, k·STEP] 만큼 밖이다. 띠 0 은 그림자 안쪽
  const target = (k: number) =>
    opacity * normalTail(((k - 0.5) * STEP) / sigma);
  const layers: { spread: number; opacity: number }[] = [];
  // 이미 깐 바깥 사각형들의 합성 진하기
  let outside = 0;
  for (let k = count; k >= 0; k--) {
    const layerOpacity = quantize(1 - (1 - target(k)) / (1 - outside));
    if (layerOpacity > 0) {
      layers.push({
        spread: k * STEP,
        opacity: Math.round(layerOpacity * 1e4) / 1e4,
      });
      outside = 1 - (1 - outside) * (1 - layerOpacity);
    }
  }
  return layers;
}

// 표준정규분포의 위쪽 꼬리 1 − Φ(z). Abramowitz–Stegun 7.1.26 근사 (오차 1.5e-7)
function normalTail(z: number) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erfc =
    t *
    (0.254829592 +
      t *
        (-0.284496736 +
          t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) *
    Math.exp(-x * x);
  return z >= 0 ? erfc / 2 : 1 - erfc / 2;
}
