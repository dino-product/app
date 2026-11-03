import { act, render, screen, userEvent } from '@testing-library/react-native';
import { Dimensions, StyleSheet, type ViewStyle } from 'react-native';
import {
  READABLE_MAX_WIDTH,
  readableColumn,
} from '../shared/layout/readableColumn';
import type { HostElement } from '../shared/testing/touchTarget';
import App from './App';

// #56: 큰 화면(태블릿, 펼친 폴더블)은 방향을 고정하지 않는다. Figma 는 휴대폰 세로 디자인뿐이라
// 넓은 창·가로에서는 본문을 읽기 좋은 폭 안에서 가운데 정렬해 깨지지 않게만 한다.
// 테스트 렌더러에는 레이아웃이 없으므로, 요소를 감싼 뷰의 스타일로 폭이 어떻게 정해지는지 확인한다.

// 창 폭의 100% 를 쓰되 600 을 넘지 않고 가운데에 둔다 (Material 3 창 크기 클래스의 Compact 상한)
const READABLE_COLUMN = { width: '100%', maxWidth: 600, alignSelf: 'center' };

// 테이블 행: [창 폭, 창 높이]. 태블릿 세로(Medium)와 가로(Expanded)
const WIDE_WINDOWS: [number, number][] = [
  [840, 1200],
  [1200, 840],
];

const initial = {
  window: Dimensions.get('window'),
  screen: Dimensions.get('screen'),
};

// useWindowDimensions 를 쓰는 화면이 다시 그려지므로 act 로 감싼다
async function resizeWindow(width: number, height: number) {
  const size = { ...initial.window, width, height };
  await act(() => Dimensions.set({ window: size, screen: size }));
}

afterEach(async () => {
  await act(() => Dimensions.set(initial));
});

const flat = (style: unknown) =>
  StyleSheet.flatten(style as ViewStyle | undefined) as ViewStyle | undefined;

// 요소에서 루트로 올라가며 최대 폭을 정한 뷰의 스타일을 찾는다.
// 스크롤 뷰 안의 요소는 스크롤 뷰의 contentContainerStyle 이 폭을 정한다 (jest 목은 안쪽 View 에 스타일을 넘기지 않는다)
function columnStyleOf(element: HostElement) {
  for (let node: HostElement | null = element; node; node = node.parent) {
    for (const style of [node.props.style, node.props.contentContainerStyle]) {
      const resolved = flat(style);
      if (resolved?.maxWidth !== undefined) {
        return resolved;
      }
    }
  }
  return undefined;
}

const expectInReadableColumn = (...elements: HostElement[]) => {
  for (const element of elements) {
    expect(columnStyleOf(element)).toEqual(
      expect.objectContaining(READABLE_COLUMN),
    );
  }
};

const header = (name: string) => screen.getByRole('header', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });

// 작업 상세의 떠 있는 "완료 보고 작성하기" 버튼을 감싼 absolute 래퍼
function jumpWrapper() {
  let node: HostElement | null = button('완료 보고 작성하기');
  while (node && flat(node.props.style)?.position !== 'absolute') {
    node = node.parent;
  }
  return node;
}

async function openPendingRequest() {
  await userEvent.press(screen.getByRole('tab', { name: '내 일정' }));
  await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
  await userEvent.press(screen.getAllByRole('button', { name: / 상세,/ })[0]);
}

describe.each(WIDE_WINDOWS)('넓은 창 %d×%d', (width, height) => {
  beforeEach(() => resizeWindow(width, height));

  it('홈: 제목·진행 중 작업·일정 카드가 읽기 좋은 폭 안에서 가운데 정렬된다', async () => {
    await render(<App />);

    expectInReadableColumn(
      header('내 작업'),
      button('보일러 점검 상세 보기'),
      button('작업 시작'),
      screen.getAllByRole('button', { name: / · / })[0],
    );
  });

  it('작업 상세: 헤더·본문·제출 버튼·떠 있는 "완료 보고 작성하기" 가 읽기 좋은 폭 안에 있다', async () => {
    await render(<App />);
    await userEvent.press(button('보일러 점검 상세 보기'));

    expectInReadableColumn(
      header('작업 상세'),
      button('뒤로 가기'),
      button('작업 전 사진 추가'),
      button('완료보고 제출'),
      button('완료 보고 작성하기'),
    );
  });

  it('작업 상세: 떠 있는 버튼 양옆 빈 곳의 터치는 아래 스크롤 뷰로 지나간다', async () => {
    await render(<App />);
    await userEvent.press(button('보일러 점검 상세 보기'));

    expect(jumpWrapper()?.props.pointerEvents).toBe('box-none');
  });

  it('내 일정: 제목·하위 탭·주간 줄·달력·응답 필요 카드가 읽기 좋은 폭 안에 있다', async () => {
    await render(<App />);
    await userEvent.press(screen.getByRole('tab', { name: '내 일정' }));

    expectInReadableColumn(
      header('내 일정'),
      screen.getByRole('tab', { name: /^확정 일정/ }),
      screen.getAllByRole('button', { name: /^\d+월 \d+일 .요일$/ })[0],
    );

    await userEvent.press(button('달력 펼치기'));
    expectInReadableColumn(button('이전 달'), button('다음 달'));

    await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
    expectInReadableColumn(
      screen.getAllByRole('button', { name: / 상세,/ })[0],
      screen.getAllByRole('button', { name: / 수락$/ })[0],
    );
  });

  it('작업 이력: 제목·월 화살표·요약 카드·완료 작업 행이 읽기 좋은 폭 안에 있다', async () => {
    await render(<App />);
    await userEvent.press(screen.getByRole('tab', { name: '작업 이력' }));

    expectInReadableColumn(
      header('작업 이력'),
      button('이전 달'),
      button('다음 달'),
      screen.getByLabelText(/^누적 완료 /),
      screen.getAllByRole('button', { name: /, 완료, / })[0],
    );
  });

  it('요청 상세·거절 사유: 헤더·본문·하단 버튼이 읽기 좋은 폭 안에 있다', async () => {
    await render(<App />);
    await openPendingRequest();

    expectInReadableColumn(
      header('작업 상세'),
      button('뒤로 가기'),
      button(/ 고객에게 전화$/),
      button('거절'),
      button('수락'),
    );

    await userEvent.press(button('거절'));
    expectInReadableColumn(
      header('거절 사유'),
      screen.getAllByRole('radio')[0],
      button('취소'),
      button('거절 제출'),
    );
  });

  it('하단 탭 바는 화면 배경처럼 창 전체 폭을 쓴다', async () => {
    await render(<App />);

    expect(columnStyleOf(screen.getByRole('tab', { name: '홈' }))).toBe(
      undefined,
    );
  });
});

// 기둥은 스타일만으로 폭이 정해져 테스트 렌더러에서는 창 크기와 상관없이 같다. 휴대폰에서 지금과 같게 그려지는 조건을 따로 지킨다
describe('휴대폰 폭에서는 지금과 같게 그려진다', () => {
  beforeEach(() => resizeWindow(375, 812));

  it('세로로 고정하는 휴대폰보다 최대 폭이 넓어, 휴대폰에서는 기둥이 창 폭 그대로다', () => {
    // MainActivity 는 짧은 변이 600dp 미만(LARGE_SCREEN_MIN_DP)이면 세로로 고정하므로 휴대폰 세로 폭은 600 보다 좁다.
    // iPhone 세로는 가장 넓어도 440pt 다
    expect(READABLE_MAX_WIDTH).toBeGreaterThanOrEqual(600);
    // 가로 여백을 더하면 휴대폰에서도 본문이 좁아진다
    expect(readableColumn).toEqual(READABLE_COLUMN);
  });

  it('떠 있는 버튼 래퍼는 좌우 위치 없이 폭 100% 와 좌우 패딩으로 놓인다 (left·right·start·end 가 있으면 폭 100% 와 겹쳐 넘친다)', async () => {
    await render(<App />);
    await userEvent.press(button('보일러 점검 상세 보기'));

    const style = flat(jumpWrapper()?.props.style);
    expect(style).toEqual(
      expect.objectContaining({ ...READABLE_COLUMN, paddingHorizontal: 24 }),
    );
    for (const inset of ['left', 'right', 'start', 'end'] as const) {
      expect(style?.[inset]).toBeUndefined();
    }
  });
});

// iOS 전용 옵션이다. 지금은 iPhone 세로 전용(#23)이라 폭이 바뀌지 않지만, 모듈 로드 때 읽은 값에 묶이지 않게 한다
describe('창 크기가 바뀌면', () => {
  // 네이티브 화면은 받는 영역(start ≤ x ≤ end) 밖의 스와이프를 거절한다
  const swipeEnd = (title: string) => {
    let node: HostElement | null = header(title).parent;
    while (node && !node.props.gestureResponseDistance) {
      node = node.parent;
    }
    return node?.props.gestureResponseDistance?.end;
  };

  it('뒤로 가기 스와이프 범위(창 폭의 왼쪽 1/3)를 새 창 폭으로 다시 계산한다', async () => {
    await resizeWindow(840, 1200);
    await render(<App />);
    await userEvent.press(button('보일러 점검 상세 보기'));
    expect(swipeEnd('작업 상세')).toBe(280);

    await resizeWindow(1200, 840);
    expect(swipeEnd('작업 상세')).toBe(400);
  });
});
