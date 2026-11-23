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
// - 지금 읽는 약관(화면 맨 위에 다 보이는 칸의 약관)이 아직 동의 전이고 그 동의 라디오가 화면에 다 보이지 않으면 버튼을 보인다.
//   전문을 받는 중이거나 받지 못한 약관에는 보이지 않는다 (보지 못한 약관에 버튼 하나로 동의하지 않게, #228 리뷰)
// - 누르면 그 라디오가 화면 아래(본문 끝 아래 여백 위)에 오도록 스크롤하고, 라디오가 화면에 다 보이면 '동의합니다' 를 고른다.
//   '동의합니다' 가 골라진 채 그려진 뒤 스크린리더 초점을 그 라디오로 옮긴다 (먼저 옮기면 고르기 전 상태를 읽는다)
// - 누른 것은 오래 남기지 않는다. 스크롤하는 동안 손으로 끌거나 라디오를 직접 고르면 거두고, 마지막으로 스크롤하고 나서
//   1.5초 안에 라디오가 다 보이지 않아도 거둔다. 끌지 않는 스크롤(스크린리더 세 손가락 스크롤·상태 바 누르기)로 점프가
//   빗나간 뒤 한참 지나 라디오가 보일 때 저절로 동의하지 않게 한다 (법적 동의, #228 리뷰)
// - 누른 뒤 그 약관이나 앞 약관의 전문이 도착해 라디오가 밀려나면 새 자리로 다시 스크롤한다
// - 목록은 화면 가까이만 그린다(가상화). 아직 재지 않은 먼 라디오면 그려 둔 끝까지 먼저 가고 잠시 뒤 다시 찾아간다.
//   그려 둔 끝이 늘어나는 동안은 계속하고, 더 늘지 않으면 멈추고 누른 것을 거둔다
// 라디오는 약관마다 전문 다음 칸(RADIOS_ITEM)이다. 머리·꼬리는 목록이 알려 주는 보이는 칸에서 서로 구분되지 않아 칸으로 둔다

/** 약관마다 전문 다음에 두는 동의 라디오 칸 */
export const RADIOS_ITEM = { kind: 'radios' } as const;

/** 다 보여야 보이는 칸으로 친다. 라디오가 다 보여야 고른다 */
export const AGREE_VIEWABILITY = { itemVisiblePercentThreshold: 100 };

/** 먼 라디오를 다시 찾아가기까지 기다리는 시간(ms)과, 그려 둔 끝이 늘지 않은 채 다시 찾아갈 최대 횟수 */
const RETRY_MS = 100;
const MAX_STALLED_RETRIES = 10;
/** 마지막으로 스크롤하고 나서 라디오가 다 보이기를 기다리는 시간(ms). 넘으면 누른 것을 거둔다 */
const REACH_MS = 1500;

type JumpSection = {
  key: string;
  /** 목록 안 순서 */
  index: number;
  data: readonly unknown[];
  /** 보일 글을 다 보였는지. 전문을 받는 중이거나 받지 못했으면 false 라 버튼이 없다 */
  readable: boolean;
};

/** 지금 읽는 약관과 그 라디오가 화면에 다 보이는지 */
type Reading = { section: number; radiosVisible: boolean };

const isRadios = (token: ListViewToken, section: number) =>
  token.item === RADIOS_ITEM &&
  (token.section as JumpSection | undefined)?.index === section;

/**
 * 목록이 펼친 순서(약관마다 머리·칸…·꼬리)를 scrollToLocation 의 자리로 바꾼다 (itemIndex 0 은 머리).
 * 범위를 넘으면 마지막 약관의 꼬리다
 */
export function toLocation(
  sections: readonly Pick<JumpSection, 'data'>[],
  flatIndex: number,
) {
  let start = 0;
  for (const [sectionIndex, section] of sections.entries()) {
    const size = section.data.length + 2;
    if (flatIndex < start + size) {
      return { sectionIndex, itemIndex: flatIndex - start };
    }
    start += size;
  }
  const last = sections.length - 1;
  return {
    sectionIndex: Math.max(0, last),
    itemIndex: last < 0 ? 0 : sections[last].data.length + 1,
  };
}

/** 약관(sectionIndex)의 라디오(마지막 칸)가 목록이 펼친 순서에서 몇 번째인지. 앞 약관의 칸 수가 바뀌어도 바뀐다 */
export function radiosFlatIndex(
  sections: readonly Pick<JumpSection, 'data'>[],
  sectionIndex: number,
) {
  let start = 0;
  for (const section of sections.slice(0, sectionIndex)) {
    start += section.data.length + 2;
  }
  return start + sections[sectionIndex].data.length;
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

  // 목록에 주는 콜백은 바뀌면 안 된다 (VirtualizedList 는 onViewableItemsChanged 를 바꾸지 못한다). 한 번만 만든다
  const [jumper] = useState(() => {
    /** 누른 뒤 고를 약관. 라디오가 다 보이면 고르고 비운다 */
    let pending: number | null = null;
    /** 마지막으로 알린 읽는 자리. 같으면 상태를 건드리지 않는다 (같은 값으로 바꿔도 React 가 한 번 더 그릴 수 있다) */
    let current: Reading | null = null;
    /** 누른 라디오로 스크롤할 때의 펼친 순서. 그 약관이나 앞 약관의 전문이 도착해 바뀌면 다시 스크롤한다 */
    let scrolledAt: number | null = null;
    /** 그려 둔 끝 칸(펼친 순서)과 그것이 늘지 않은 채 다시 찾아간 횟수 */
    let highest = -1;
    let stalls = 0;
    /** 먼 라디오를 다시 찾아가는 타이머와, 라디오에 닿지 못하면 누른 것을 거두는 타이머 */
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let giveUpTimer: ReturnType<typeof setTimeout> | null = null;
    /** 앵커로 고른 약관. '동의합니다' 가 골라진 채 그려지면 그 라디오로 스크린리더 초점을 옮기고 비운다 */
    let focusKey: string | null = null;
    const radios = new Map<string, PressableInstance>();

    const clearTimers = () => {
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (giveUpTimer !== null) {
        clearTimeout(giveUpTimer);
        giveUpTimer = null;
      }
    };
    const cancel = () => {
      pending = null;
      focusKey = null;
      clearTimers();
    };
    const scrollToRadios = (sectionIndex: number) => {
      const { sections: list, bottomSpace: space } = latest.current;
      const section = list[sectionIndex];
      if (section === undefined) {
        cancel();
        return;
      }
      scrolledAt = radiosFlatIndex(list, sectionIndex);
      // 스크롤할 때마다 기다리는 시간을 새로 잰다. 스크롤이 바로 실패해 멈추면(cancel) 함께 지워지게 먼저 건다
      if (giveUpTimer !== null) {
        clearTimeout(giveUpTimer);
      }
      giveUpTimer = setTimeout(() => {
        giveUpTimer = null;
        cancel();
      }, REACH_MS);
      // 라디오는 약관의 마지막 칸이고 scrollToLocation 의 칸 번호는 머리(0) 다음부터다
      listRef.current?.scrollToLocation({
        sectionIndex,
        itemIndex: section.data.length,
        viewPosition: 1,
        viewOffset: -space,
        animated: true,
      });
    };
    const agree = (sectionIndex: number) => {
      const { sections: list, onAgreeChange: change } = latest.current;
      const key = list[sectionIndex]?.key;
      if (key === undefined || change === undefined) {
        return;
      }
      focusKey = key;
      change(key, true);
    };

    return {
      jump(sectionIndex: number) {
        cancel();
        pending = sectionIndex;
        highest = -1;
        stalls = 0;
        scrollToRadios(sectionIndex);
      },
      /** 전문이 도착해 누른 라디오의 펼친 순서가 바뀌었으면 새 자리로 다시 스크롤한다 */
      resync() {
        if (pending === null) {
          return;
        }
        const { sections: list } = latest.current;
        const at =
          list[pending] === undefined ? null : radiosFlatIndex(list, pending);
        if (at !== scrolledAt) {
          scrollToRadios(pending);
        }
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
          cancel();
          agree(target);
        }
      },
      onScrollToIndexFailed({
        highestMeasuredFrameIndex,
      }: {
        highestMeasuredFrameIndex: number;
      }) {
        if (pending === null) {
          return;
        }
        if (highestMeasuredFrameIndex > highest) {
          highest = highestMeasuredFrameIndex;
          stalls = 0;
        } else if (stalls >= MAX_STALLED_RETRIES) {
          // 더 그리지 못한다. 누른 것을 거두어 나중에 라디오가 보여도 저절로 고르지 않는다
          cancel();
          return;
        } else {
          stalls += 1;
        }
        listRef.current?.scrollToLocation({
          ...toLocation(latest.current.sections, highestMeasuredFrameIndex),
          viewPosition: 0,
          animated: true,
        });
        if (retryTimer !== null) {
          clearTimeout(retryTimer);
        }
        retryTimer = setTimeout(() => {
          retryTimer = null;
          if (pending !== null) {
            scrollToRadios(pending);
          }
        }, RETRY_MS);
      },
      /** 손으로 끌면 누른 것을 거둔다 */
      onScrollBeginDrag: cancel,
      /** 라디오를 직접 고르면 누른 것을 거두고 그 선택을 알린다 */
      choose(key: string, agreed: boolean) {
        cancel();
        latest.current.onAgreeChange?.(key, agreed);
      },
      registerRadio(key: string, radio: PressableInstance | null) {
        if (radio === null) {
          radios.delete(key);
        } else {
          radios.set(key, radio);
        }
      },
      /** 앵커로 고른 '동의합니다' 가 골라진 채 그려졌으면 그 라디오로 스크린리더 초점을 옮긴다 */
      focusAgreed(agreed?: Readonly<Record<string, boolean>>) {
        if (focusKey === null || !(agreed?.[focusKey] ?? false)) {
          return;
        }
        const radio = radios.get(focusKey);
        focusKey = null;
        if (radio) {
          AccessibilityInfo.sendAccessibilityEvent(radio, 'focus');
        }
      },
      stop: cancel,
    };
  });
  useLayoutEffect(() => {
    latest.current = { sections, onAgreeChange, bottomSpace };
    jumper.resync();
  });
  // 앵커로 고른 '동의합니다' 가 그려진 뒤에 초점을 옮긴다
  useEffect(() => {
    jumper.focusAgreed(agreement);
  }, [jumper, agreement]);
  // 화면을 떠나면 누른 것을 거두고 타이머를 멈춘다
  useEffect(() => jumper.stop, [jumper]);

  const section = reading === null ? undefined : sections[reading.section];
  const target =
    reading !== null &&
    section !== undefined &&
    section.readable &&
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
    /** 라디오의 onChange. 누른 것을 거두고 onAgreeChange 로 알린다 */
    choose: jumper.choose,
    registerRadio: jumper.registerRadio,
  };
}
