import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { BackHandler, FlatList, Linking } from 'react-native';
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
