import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  type ListViewToken,
  type PressableInstance,
  type SectionList,
} from 'react-native';

// 가입 약관 상세의 '약관 동의하기' 앵커 (#218, 사용자 요청: 작업 상세 '완료 보고 작성하기' 앵커와 같은 모양).
// - 지금 읽는 약관(화면 맨 위에 다 보이는 칸의 약관)이 아직 동의 전이고 그 동의 라디오가 화면에 다 보이지 않으면 버튼을 보인다
// - 누르면 그 라디오가 화면 아래(본문 끝 아래 여백 위)에 오도록 스크롤하고, 라디오가 화면에 다 보이면 '동의합니다' 를 고른 뒤
//   스크린리더 초점을 그 라디오로 옮긴다. 스크롤하는 동안 손으로 끌면 고르지 않는다
// - 목록은 화면 가까이만 그린다(가상화). 아직 재지 않은 먼 라디오면 그려 둔 끝까지 먼저 가고 잠시 뒤 다시 찾아간다
// 라디오는 약관마다 전문 다음 칸(RADIOS_ITEM)이다. 머리·꼬리는 목록이 알려 주는 보이는 칸에서 서로 구분되지 않아 칸으로 둔다

/** 약관마다 전문 다음에 두는 동의 라디오 칸 */
export const RADIOS_ITEM = { kind: 'radios' } as const;

/** 다 보여야 보이는 칸으로 친다. 라디오가 다 보여야 고른다 */
export const AGREE_VIEWABILITY = { itemVisiblePercentThreshold: 100 };

/** 먼 라디오를 다시 찾아가기까지 기다리는 시간(ms)과 최대 횟수 */
const RETRY_MS = 100;
const MAX_RETRIES = 10;

type JumpSection = {
  key: string;
  /** 목록 안 순서 */
  index: number;
  data: readonly unknown[];
};

/** 지금 읽는 약관과 그 라디오가 화면에 다 보이는지 */
type Reading = { section: number; radiosVisible: boolean };

const isRadios = (token: ListViewToken, section: number) =>
  token.item === RADIOS_ITEM &&
  (token.section as JumpSection | undefined)?.index === section;

/** 목록이 펼친 순서(약관마다 머리·칸…·꼬리)를 scrollToLocation 의 자리로 바꾼다 (itemIndex 0 은 머리) */
function toLocation(sections: readonly JumpSection[], flatIndex: number) {
  let start = 0;
  for (const [sectionIndex, section] of sections.entries()) {
    const size = section.data.length + 2;
    if (flatIndex < start + size) {
      return { sectionIndex, itemIndex: flatIndex - start };
    }
    start += size;
  }
  return { sectionIndex: 0, itemIndex: 0 };
}

export function useAgreeJump<ItemT, SectionT extends JumpSection>({
  sections,
  agreement,
  onAgreeChange,
  bottomSpace,
}: {
  sections: readonly SectionT[];
  /** 없으면 읽기만 하는 상세(마이 › 약관)라 버튼이 없다 */
  agreement?: Readonly<Record<string, boolean>>;
  onAgreeChange?: (key: string, agreed: boolean) => void;
  /** 라디오 아래에 남길 거리 (본문 끝 아래 여백 + 아래 안전 영역) */
  bottomSpace: number;
}) {
  const listRef = useRef<SectionList<ItemT, SectionT>>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const latest = useRef({ sections, onAgreeChange, bottomSpace });
  useLayoutEffect(() => {
    latest.current = { sections, onAgreeChange, bottomSpace };
  });

  // 목록에 주는 콜백은 바뀌면 안 된다 (VirtualizedList 는 onViewableItemsChanged 를 바꾸지 못한다). 한 번만 만든다
  const [jumper] = useState(() => {
    /** 누른 뒤 고를 약관. 라디오가 다 보이면 고르고 비운다 */
    let pending: number | null = null;
    /** 마지막으로 알린 읽는 자리. 같으면 상태를 건드리지 않는다 (같은 값으로 바꿔도 React 가 한 번 더 그릴 수 있다) */
    let current: Reading | null = null;
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const radios = new Map<string, PressableInstance>();

    const stopRetry = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };
    const scrollToRadios = (sectionIndex: number) => {
      const section = latest.current.sections[sectionIndex];
      if (section === undefined) {
        return;
      }
      // 라디오는 약관의 마지막 칸이고 scrollToLocation 의 칸 번호는 머리(0) 다음부터다
      listRef.current?.scrollToLocation({
        sectionIndex,
        itemIndex: section.data.length,
        viewPosition: 1,
        viewOffset: -latest.current.bottomSpace,
        animated: true,
      });
    };
    const agree = (sectionIndex: number) => {
      const { sections: list, onAgreeChange: change } = latest.current;
      const key = list[sectionIndex]?.key;
      if (key === undefined || change === undefined) {
        return;
      }
      change(key, true);
      const radio = radios.get(key);
      if (radio) {
        AccessibilityInfo.sendAccessibilityEvent(radio, 'focus');
      }
    };

    return {
      jump(sectionIndex: number) {
        stopRetry();
        pending = sectionIndex;
        retries = 0;
        scrollToRadios(sectionIndex);
      },
      onViewableItemsChanged({
        viewableItems,
      }: {
        viewableItems: ListViewToken[];
      }) {
        const top = viewableItems[0]?.section as SectionT | undefined;
        if (top === undefined) {
          return;
        }
        const radiosVisible = (section: number) =>
          viewableItems.some(token => isRadios(token, section));
        const next = {
          section: top.index,
          radiosVisible: radiosVisible(top.index),
        };
        if (
          current?.section !== next.section ||
          current.radiosVisible !== next.radiosVisible
        ) {
          current = next;
          setReading(next);
        }
        if (pending !== null && radiosVisible(pending)) {
          const target = pending;
          pending = null;
          stopRetry();
          agree(target);
        }
      },
      onScrollToIndexFailed({
        highestMeasuredFrameIndex,
      }: {
        highestMeasuredFrameIndex: number;
      }) {
        if (pending === null || retries >= MAX_RETRIES) {
          return;
        }
        retries += 1;
        listRef.current?.scrollToLocation({
          ...toLocation(latest.current.sections, highestMeasuredFrameIndex),
          viewPosition: 0,
          animated: true,
        });
        stopRetry();
        timer = setTimeout(() => {
          timer = null;
          if (pending !== null) {
            scrollToRadios(pending);
          }
        }, RETRY_MS);
      },
      /** 손으로 끌면 누른 것을 거둔다 */
      onScrollBeginDrag() {
        pending = null;
        stopRetry();
      },
      registerRadio(key: string, radio: PressableInstance | null) {
        if (radio === null) {
          radios.delete(key);
        } else {
          radios.set(key, radio);
        }
      },
      stop: stopRetry,
    };
  });
  // 화면을 떠나면 다시 찾아가기를 멈춘다
  useEffect(() => jumper.stop, [jumper]);

  const section = reading === null ? undefined : sections[reading.section];
  const target =
    reading !== null &&
    section !== undefined &&
    agreement !== undefined &&
    onAgreeChange !== undefined &&
    !reading.radiosVisible &&
    !(agreement[section.key] ?? false)
      ? reading.section
      : null;
  const jump = useCallback(() => {
    if (target !== null) {
      jumper.jump(target);
    }
  }, [jumper, target]);

  return {
    listRef,
    /** 버튼이 가리키는 약관 (목록 안 순서). 없으면 버튼을 숨긴다 */
    target,
    jump,
    onViewableItemsChanged: jumper.onViewableItemsChanged,
    onScrollToIndexFailed: jumper.onScrollToIndexFailed,
    onScrollBeginDrag: jumper.onScrollBeginDrag,
    registerRadio: jumper.registerRadio,
  };
}
