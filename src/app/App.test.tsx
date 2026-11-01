import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import {
  AccessibilityInfo,
  BackHandler,
  FlatList,
  Linking,
} from 'react-native';
import { colors } from '../shared/design-system';
import App from './App';

// 네이티브 스택은 아래 화면을 그대로 두고 스크린리더에서만 숨긴다 (aria-hidden).
// 그래서 "지금 보이는 화면" 은 헤더가 접근성 트리에 있는지로 확인한다.
const header = (name: string) => screen.queryByRole('header', { name });
const tab = (name: string) => screen.getByRole('tab', { name });
// 탭 바(tablist)는 accessible 요소가 아니라 역할로 못 찾으므로 탭 버튼으로 확인한다
const tabBar = () => screen.queryByRole('tab', { name: '홈' });

describe('App', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('첫 화면은 작업 수행 메인화면(내 작업)이고 하단 탭은 홈이다', async () => {
    await render(<App />);

    expect(header('내 작업')).toBeOnTheScreen();
    expect(tab('홈')).toBeSelected();
  });

  it('작업을 열면 탭 바가 있는 작업 상세로, 뒤로 가기로 메인화면으로 돌아온다', async () => {
    await render(<App />);

    await userEvent.press(
      screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
    );
    expect(header('작업 상세')).toBeOnTheScreen();
    expect(header('내 작업')).not.toBeOnTheScreen();
    expect(tab('홈')).toBeSelected();

    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(header('내 작업')).toBeOnTheScreen();
    expect(header('작업 상세')).not.toBeOnTheScreen();
  });

  it('전환 중에 작업 카드를 한 번 더 눌러도 상세는 하나만 쌓인다', async () => {
    await render(<App />);
    const card = screen.getByRole('button', { name: '보일러 점검 상세 보기' });

    await fireEvent.press(card);
    // 상세가 올라오는 동안 아래 카드가 한 번 더 눌린 경우
    await fireEvent.press(card);
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(header('내 작업')).toBeOnTheScreen();
  });

  it('작업을 시작하고 상세에 다녀와도 "작업 수행중" 이 유지된다', async () => {
    await render(<App />);

    await userEvent.press(screen.getByRole('button', { name: '작업 시작' }));
    await userEvent.press(screen.getByRole('button', { name: '작업 수행중' }));
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(
      screen.getByRole('button', { name: '작업 수행중' }),
    ).toBeOnTheScreen();
  });

  describe('Android 뒤로가기', () => {
    // RN BackHandler 처럼 나중에 등록한 핸들러부터 부르고, 하나가 처리(true)하면 멈춘다.
    // 아무도 처리하지 않으면(false) RN 은 앱을 나간다.
    async function renderWithBackButton() {
      type Handler = Parameters<typeof BackHandler.addEventListener>[1];
      const handlers = new Set<Handler>();
      jest
        .spyOn(BackHandler, 'addEventListener')
        .mockImplementation((_event, handler) => {
          handlers.add(handler);
          return { remove: () => handlers.delete(handler) };
        });
      await render(<App />);

      return async () => {
        let handled = false;
        await act(() => {
          // 이벤트 인자는 쓰지 않는다
          handled = [...handlers]
            .reverse()
            .some(handler => handler(undefined as never) === true);
        });
        return handled;
      };
    }

    it('상세에서 누르면 메인화면으로 돌아온다', async () => {
      const pressBack = await renderWithBackButton();

      await userEvent.press(
        screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
      );

      expect(await pressBack()).toBe(true);
      expect(header('내 작업')).toBeOnTheScreen();
      expect(header('작업 상세')).not.toBeOnTheScreen();
    });

    it('요청 상세(탭 위 루트 스택)에서 누르면 내 일정으로 돌아온다', async () => {
      const pressBack = await renderWithBackButton();

      await userEvent.press(tab('내 일정'));
      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
      await userEvent.press(
        screen.getAllByRole('button', { name: / 상세,/ })[0],
      );

      expect(await pressBack()).toBe(true);
      expect(header('내 일정')).toBeOnTheScreen();
      expect(header('작업 상세')).not.toBeOnTheScreen();
    });

    it('다른 탭 첫 화면에서는 홈 탭으로, 홈 첫 화면에서는 앱이 처리하지 않는다(앱 나감)', async () => {
      const pressBack = await renderWithBackButton();

      await userEvent.press(tab('내 일정'));
      expect(await pressBack()).toBe(true);
      expect(tab('홈')).toBeSelected();
      expect(header('내 작업')).toBeOnTheScreen();

      expect(await pressBack()).toBe(false);
      expect(header('내 작업')).toBeOnTheScreen();
    });
  });

  it('완료 보고를 제출하고 메인으로 돌아오면 다시 "작업 시작" 상태다', async () => {
    await render(<App />);

    await userEvent.press(screen.getByRole('button', { name: '작업 시작' }));
    await userEvent.press(screen.getByRole('button', { name: '작업 수행중' }));
    await userEvent.press(
      screen.getByRole('button', { name: '작업 전 사진 추가' }),
    );
    await userEvent.press(
      screen.getByRole('button', { name: '작업 후 사진 추가' }),
    );
    await userEvent.type(screen.getByLabelText('결제 금액 입력'), '75000');
    await userEvent.press(
      screen.getByRole('button', { name: '결제 방식 선택' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '카드' }));
    await userEvent.press(
      screen.getByRole('button', { name: '완료보고 제출' }),
    );
    await userEvent.press(
      await screen.findByRole('button', { name: '메인 화면으로' }),
    );

    expect(header('내 작업')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '작업 시작' })).toBeOnTheScreen();
  });

  it('상세에서 지금 탭("홈")을 다시 누르면 그 탭의 첫 화면으로 돌아간다', async () => {
    await render(<App />);

    await userEvent.press(
      screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
    );
    await userEvent.press(tab('홈'));

    expect(
      await screen.findByRole('header', { name: '내 작업' }),
    ).toBeOnTheScreen();
    expect(header('작업 상세')).not.toBeOnTheScreen();
  });

  it('다른 탭에 다녀와도 탭마다 보던 화면이 남아 있다', async () => {
    await render(<App />);

    await userEvent.press(
      screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
    );
    await userEvent.press(tab('내 일정'));
    expect(header('내 일정')).toBeOnTheScreen();
    expect(header('작업 상세')).not.toBeOnTheScreen();

    await userEvent.press(tab('홈'));
    expect(header('작업 상세')).toBeOnTheScreen();
    expect(header('내 일정')).not.toBeOnTheScreen();
  });

  it('탭을 오가도 작성하던 완료 보고 입력이 남아 있다', async () => {
    await render(<App />);

    await userEvent.press(
      screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
    );
    await userEvent.type(screen.getByLabelText('수행 메모 입력'), '배관 교체');
    await userEvent.press(tab('내 일정'));
    await userEvent.press(tab('홈'));

    expect(screen.getByLabelText('수행 메모 입력')).toHaveDisplayValue(
      '배관 교체',
    );
  });

  // 탭 화면은 떠나도 마운트된 채로 남는다 (예전 수작업 탭 전환은 다른 탭을 언마운트해 날짜·하위 탭·달력 상태가 초기화됐다)
  it('홈에 다녀와도 내 일정에서 고른 하위 탭이 남아 있다', async () => {
    await render(<App />);

    await userEvent.press(tab('내 일정'));
    await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
    await userEvent.press(tab('홈'));
    await userEvent.press(tab('내 일정'));

    expect(screen.getByRole('tab', { name: /^응답 필요/ })).toBeSelected();
  });

  it('홈 첫 화면에서 홈 탭을 다시 눌러도 그대로다', async () => {
    await render(<App />);

    await userEvent.press(tab('홈'));

    expect(header('내 작업')).toBeOnTheScreen();
    expect(tab('홈')).toBeSelected();
  });

  describe('지금 탭을 다시 누르면 리스트를 맨 위로', () => {
    // 탭 다시 누름 처리(첫 화면으로·맨 위로)는 다음 프레임에 돈다
    const nextFrame = () =>
      act(() => new Promise(resolve => requestAnimationFrame(resolve)));
    // 테스트 환경의 리스트는 스크롤 위치가 없어 맨 위로 보내는 호출로 확인한다
    const spyScroll = () => jest.spyOn(FlatList.prototype, 'scrollToOffset');
    const toTop = expect.objectContaining({ offset: 0 });

    it('홈 첫 화면에서 홈 탭을 다시 누르면 맨 위로 간다', async () => {
      const scroll = spyScroll();
      await render(<App />);

      await userEvent.press(tab('홈'));
      await nextFrame();

      expect(scroll).toHaveBeenCalledTimes(1);
      expect(scroll).toHaveBeenCalledWith(toTop);
    });

    it('상세가 열려 있으면 첫 화면으로만 돌아가고, 한 번 더 누르면 맨 위로 간다', async () => {
      const scroll = spyScroll();
      await render(<App />);

      await userEvent.press(
        screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
      );
      await userEvent.press(tab('홈'));
      await nextFrame();
      expect(header('내 작업')).toBeOnTheScreen();
      expect(scroll).not.toHaveBeenCalled();

      await userEvent.press(tab('홈'));
      await nextFrame();
      expect(scroll).toHaveBeenCalledTimes(1);
      expect(scroll).toHaveBeenCalledWith(toTop);
    });

    it('내 일정 탭을 다시 누르면 보이는 리스트(확정 일정·응답 필요)가 맨 위로 간다', async () => {
      const scroll = spyScroll();
      await render(<App />);

      await userEvent.press(tab('내 일정'));
      await userEvent.press(tab('내 일정'));
      await nextFrame();
      expect(scroll).toHaveBeenCalledTimes(1);
      expect(scroll).toHaveBeenLastCalledWith(toTop);

      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
      await userEvent.press(tab('내 일정'));
      await nextFrame();
      expect(scroll).toHaveBeenCalledTimes(2);
      expect(scroll).toHaveBeenLastCalledWith(toTop);
    });

    it('다른 탭으로 옮길 때는 스크롤하지 않는다', async () => {
      const scroll = spyScroll();
      await render(<App />);

      // 탭은 처음 열 때 마운트되므로, 두 탭을 모두 연 뒤에 오가야 양쪽 리스너가 걸린 상태다
      for (const name of ['내 일정', '홈', '내 일정', '홈']) {
        await userEvent.press(tab(name));
        await nextFrame();
      }

      expect(scroll).not.toHaveBeenCalled();
    });
  });

  describe('VoiceOver', () => {
    // 네이티브 스택은 전환이 끝나면 화면의 onAppear 를 부른다. 테스트 환경에는 전환이 없어 직접 보낸다
    const finishTransition = (title: string) =>
      fireEvent(screen.getByRole('header', { name: title }), 'appear');
    // 두 손가락 Z: VoiceOver 는 포커스한 요소에서 위로 올라가며 escape 를 받는 뷰를 찾는다
    const escapeTarget = (title: string) => {
      let node = screen.getByRole('header', { name: title }).parent;
      while (node && !node.props.onAccessibilityEscape) {
        node = node.parent;
      }
      return node;
    };
    // RN 의 escape 이벤트는 버블링하지 않으므로 받는 뷰에 직접 보낸다
    const escapeFrom = (title: string) => {
      const target = escapeTarget(title);
      if (!target) {
        throw new Error(`"${title}" 화면은 escape 를 받지 않는다`);
      }
      return fireEvent(target, 'accessibilityEscape');
    };
    // jest 프리셋이 이미 목으로 둬서 spyOn 이 같은 목을 돌려준다. 앞 테스트의 호출을 지운다
    const spyFocus = () =>
      jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear();
    // 테스트 환경의 Text ref 는 목 컴포넌트 인스턴스라 props 로 어떤 제목인지 확인한다
    const titleNode = (name: string) =>
      expect.objectContaining({
        props: expect.objectContaining({
          accessibilityRole: 'header',
          children: name,
        }),
      });

    it('작업 상세는 전환이 끝나면 포커스가 제목으로 간다', async () => {
      const focus = spyFocus();
      await render(<App />);

      await userEvent.press(
        screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
      );
      // 전환 중에 옮기면 전환이 끝날 때 플랫폼이 포커스를 다시 잡는다
      expect(focus).not.toHaveBeenCalled();

      await finishTransition('작업 상세');
      expect(focus).toHaveBeenCalledTimes(1);
      expect(focus).toHaveBeenCalledWith(titleNode('작업 상세'), 'focus');
    });

    // 열리는 중에 위 화면이 또 열리면 이 화면은 보이기 전에 닫힘 전환부터 받는다
    it('닫힘 전환으로는 포커스를 옮기지 않고, 그 뒤 처음 보일 때 옮긴다', async () => {
      const focus = spyFocus();
      await render(<App />);

      await userEvent.press(
        screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
      );
      await fireEvent(
        screen.getByRole('header', { name: '작업 상세' }),
        'disappear',
      );
      expect(focus).not.toHaveBeenCalled();

      await finishTransition('작업 상세');
      expect(focus).toHaveBeenCalledTimes(1);
    });

    it('요청 상세·거절 사유도 열릴 때 제목으로 가고, 돌아온 화면에서는 다시 옮기지 않는다', async () => {
      const focus = spyFocus();
      await render(<App />);
      await userEvent.press(tab('내 일정'));
      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));

      await userEvent.press(
        screen.getAllByRole('button', { name: / 상세,/ })[0],
      );
      await finishTransition('작업 상세');
      await userEvent.press(screen.getByRole('button', { name: '거절' }));
      await finishTransition('거절 사유');
      expect(focus).toHaveBeenNthCalledWith(1, titleNode('작업 상세'), 'focus');
      expect(focus).toHaveBeenNthCalledWith(2, titleNode('거절 사유'), 'focus');

      // 돌아온 화면은 플랫폼의 포커스 복원(열었던 버튼)에 맡긴다
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      await finishTransition('작업 상세');
      expect(focus).toHaveBeenCalledTimes(2);
    });

    it('작업 상세에서 두 손가락 Z 로 메인화면으로 돌아온다', async () => {
      await render(<App />);

      await userEvent.press(
        screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
      );
      await escapeFrom('작업 상세');

      expect(header('내 작업')).toBeOnTheScreen();
      expect(header('작업 상세')).not.toBeOnTheScreen();
    });

    it('거절 사유 → 요청 상세 → 내 일정 순서로 두 손가락 Z 로 돌아온다', async () => {
      await render(<App />);
      await userEvent.press(tab('내 일정'));
      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
      await userEvent.press(
        screen.getAllByRole('button', { name: / 상세,/ })[0],
      );
      await userEvent.press(screen.getByRole('button', { name: '거절' }));

      await escapeFrom('거절 사유');
      expect(header('작업 상세')).toBeOnTheScreen();
      expect(header('거절 사유')).not.toBeOnTheScreen();

      await escapeFrom('작업 상세');
      expect(header('내 일정')).toBeOnTheScreen();
      expect(header('작업 상세')).not.toBeOnTheScreen();
    });

    // Android 뒤로가기(다른 탭 첫 화면 → 홈 탭)와 달리 탭을 바꾸지 않는다.
    // 아무도 받지 않아야 VoiceOver 가 돌아갈 곳이 없다고 처리한다
    it('탭 첫 화면은 두 손가락 Z 를 받지 않는다', async () => {
      await render(<App />);
      expect(escapeTarget('내 작업')).toBeNull();

      await userEvent.press(tab('내 일정'));
      expect(escapeTarget('내 일정')).toBeNull();
    });

    it('escape 를 받는 뷰는 iOS 뷰 평탄화로 사라지지 않는다', async () => {
      await render(<App />);

      await userEvent.press(
        screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
      );

      // Fabric 은 escape 핸들러만 있는 View 를 평탄화해 네이티브 뷰로 만들지 않는다
      expect(escapeTarget('작업 상세')?.props.collapsable).toBe(false);
    });
  });

  it('작업 이력·마이는 화면이 없어 눌러도 지금 탭에 머문다', async () => {
    await render(<App />);

    await userEvent.press(tab('작업 이력'));
    await userEvent.press(tab('마이'));

    expect(tab('홈')).toBeSelected();
    expect(header('내 작업')).toBeOnTheScreen();
  });

  it('탭 바 둥근 모서리 뒤는 지금 화면의 배경색이다 (홈 메인만 회색)', async () => {
    await render(<App />);
    const backdrop = () => screen.getByTestId('main-tab-bar');

    expect(backdrop()).toHaveStyle({ backgroundColor: colors.background[3] });

    await userEvent.press(
      screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
    );
    expect(backdrop()).toHaveStyle({ backgroundColor: colors.white[100] });

    await userEvent.press(tab('내 일정'));
    expect(backdrop()).toHaveStyle({ backgroundColor: colors.white[100] });
  });

  it('전화·길찾기 링크를 열지 못해도 앱이 처리되지 않은 오류를 내지 않는다', async () => {
    const openURL = jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValue(new Error('no handler'));
    await render(<App />);

    await userEvent.press(
      screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
    );
    await userEvent.press(
      screen.getByRole('button', { name: '박민지 고객에게 전화' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '길찾기' }));

    expect(openURL).toHaveBeenCalledWith('tel:010-1234-5678');
    expect(openURL).toHaveBeenLastCalledWith(
      expect.stringMatching(/^(https:\/\/maps\.apple\.com\/\?q=|geo:0,0\?q=)/),
    );
  });

  describe('내 일정', () => {
    async function openPending() {
      await render(<App />);
      await userEvent.press(tab('내 일정'));
      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
    }

    it('하단 탭으로 내 일정과 홈을 오간다', async () => {
      await render(<App />);

      await userEvent.press(tab('내 일정'));
      expect(header('내 일정')).toBeOnTheScreen();
      expect(tab('내 일정')).toBeSelected();

      await userEvent.press(tab('홈'));
      expect(header('내 작업')).toBeOnTheScreen();
      expect(tab('홈')).toBeSelected();
    });

    it('응답 필요 요청을 수락하면 목록에서 빠진다', async () => {
      await openPending();
      const before = screen.getAllByRole('button', { name: /수락$/ }).length;

      await userEvent.press(
        screen.getAllByRole('button', { name: /수락$/ })[0],
      );

      expect(screen.queryAllByRole('button', { name: /수락$/ })).toHaveLength(
        before - 1,
      );
    });

    it('거절하면 탭 바 없는 거절 사유를 받고 요청을 목록에서 뺀다', async () => {
      await openPending();
      const before = screen.getAllByRole('button', { name: /거절$/ }).length;

      await userEvent.press(
        screen.getAllByRole('button', { name: /거절$/ })[0],
      );
      expect(header('거절 사유')).toBeOnTheScreen();
      expect(tabBar()).not.toBeOnTheScreen();

      await userEvent.press(
        screen.getByRole('radio', { name: '일정이 맞지 않습니다' }),
      );
      await userEvent.press(screen.getByRole('button', { name: '거절 제출' }));

      expect(header('내 일정')).toBeOnTheScreen();
      expect(header('거절 사유')).not.toBeOnTheScreen();
      expect(screen.queryAllByRole('button', { name: /거절$/ })).toHaveLength(
        before - 1,
      );
    });

    it('요청 상세(탭 바 없음)에서 수락하면 내 일정으로 돌아오고 요청이 빠진다', async () => {
      await openPending();
      const before = screen.getAllByRole('button', { name: /수락$/ }).length;

      await userEvent.press(
        screen.getAllByRole('button', { name: / 상세,/ })[0],
      );
      expect(header('작업 상세')).toBeOnTheScreen();
      expect(tabBar()).not.toBeOnTheScreen();

      await userEvent.press(screen.getByRole('button', { name: '수락' }));

      expect(header('내 일정')).toBeOnTheScreen();
      expect(header('작업 상세')).not.toBeOnTheScreen();
      expect(tabBar()).toBeOnTheScreen();
      expect(screen.queryAllByRole('button', { name: /수락$/ })).toHaveLength(
        before - 1,
      );
    });

    it('요청 상세에서 뒤로 가면 내 일정으로 돌아온다', async () => {
      await openPending();

      await userEvent.press(
        screen.getAllByRole('button', { name: / 상세,/ })[0],
      );
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

      expect(header('내 일정')).toBeOnTheScreen();
      expect(header('작업 상세')).not.toBeOnTheScreen();
    });

    it('요청 상세 → 거절 사유에서 뒤로 가면 상세로, 제출하면 내 일정까지 돌아온다', async () => {
      await openPending();
      const before = screen.getAllByRole('button', { name: /거절$/ }).length;

      await userEvent.press(
        screen.getAllByRole('button', { name: / 상세,/ })[0],
      );
      await userEvent.press(screen.getByRole('button', { name: '거절' }));
      expect(header('거절 사유')).toBeOnTheScreen();

      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(header('작업 상세')).toBeOnTheScreen();
      expect(header('거절 사유')).not.toBeOnTheScreen();

      await userEvent.press(screen.getByRole('button', { name: '거절' }));
      await userEvent.press(
        screen.getByRole('radio', { name: '일정이 맞지 않습니다' }),
      );
      await userEvent.press(screen.getByRole('button', { name: '거절 제출' }));

      expect(header('내 일정')).toBeOnTheScreen();
      expect(header('작업 상세')).not.toBeOnTheScreen();
      expect(screen.queryAllByRole('button', { name: /거절$/ })).toHaveLength(
        before - 1,
      );
    });
  });
});
