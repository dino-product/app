import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import {
  AccessibilityInfo,
  Alert,
  BackHandler,
  Dimensions,
  type AlertButton,
} from 'react-native';
import { escapeFrom, escapeTarget } from '../../jest/voiceOver';
import { colors } from '../shared/design-system';
import App from './App';

// 마이 탭(#72). 네이티브 스택은 아래 화면을 스크린리더에서만 숨기므로
// "지금 보이는 화면" 은 헤더가 접근성 트리에 있는지로 확인한다 (App.test 와 같은 방식)
const header = (name: string) => screen.queryByRole('header', { name });
const tab = (name: string) => screen.getByRole('tab', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });

// 프리셋의 Alert 는 네이티브 목으로 이어지므로 띄우지 않게 막는다
const spyAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});
const pressAlertButton = async (
  alert: ReturnType<typeof spyAlert>,
  text: string,
) => {
  const buttons: AlertButton[] = alert.mock.calls.at(-1)?.[2] ?? [];
  await act(() => buttons.find(item => item.text === text)?.onPress?.());
};

async function openMyPage() {
  await render(<App />);
  await userEvent.press(tab('마이'));
}

// 마이페이지에서 바로 여는 하위 화면: [누를 버튼, 열린 화면 제목]
const subScreens = [
  ['알림센터', '알림센터'],
  [/^김현진/, '프로필 수정'],
  ['알림 설정', '알림 설정'],
  ['약관 및 앱 정보', '약관 및 앱 정보'],
  ['계정 관리', '계정 관리'],
] as const;

describe('App — 마이 탭', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('하단 탭 마이를 누르면 마이페이지가 열리고 탭이 활성이다', async () => {
    await openMyPage();

    expect(header('마이페이지')).toBeOnTheScreen();
    expect(tab('마이')).toBeSelected();
    expect(header('내 작업')).not.toBeOnTheScreen();
  });

  it('마이페이지는 회색 배경이라 탭 바 둥근 모서리 뒤도 회색이다', async () => {
    await openMyPage();

    expect(screen.getByTestId('main-tab-bar')).toHaveStyle({
      backgroundColor: colors.background[3],
    });

    await userEvent.press(button('알림 설정'));
    expect(screen.getByTestId('main-tab-bar')).toHaveStyle({
      backgroundColor: colors.white[100],
    });
  });

  it.each(subScreens)(
    '%s 를 누르면 탭 바가 있는 %s 로 가고, 뒤로 가기로 돌아온다',
    async (name, title) => {
      await openMyPage();

      await userEvent.press(button(name));
      expect(header(title)).toBeOnTheScreen();
      expect(header('마이페이지')).not.toBeOnTheScreen();
      expect(tab('마이')).toBeSelected();

      await userEvent.press(button('뒤로 가기'));
      expect(header('마이페이지')).toBeOnTheScreen();
      expect(header(title)).not.toBeOnTheScreen();
    },
  );

  it('신청 현황·조직 참여는 화면이 생길 때까지(#73) 마이페이지에 머문다', async () => {
    await openMyPage();

    await userEvent.press(button('신청 현황, 3건'));
    await userEvent.press(button('조직 참여'));

    expect(header('마이페이지')).toBeOnTheScreen();
  });

  it('프로필을 저장하면 마이페이지로 돌아와 바뀐 이름·연락처를 보여준다', async () => {
    await openMyPage();

    await userEvent.press(button(/^김현진/));
    await userEvent.clear(screen.getByLabelText('이름'));
    await userEvent.type(screen.getByLabelText('이름'), '박기사');
    await userEvent.clear(screen.getByLabelText('연락처'));
    await userEvent.type(screen.getByLabelText('연락처'), '01098765432');
    await userEvent.press(button('저장하기'));

    expect(header('마이페이지')).toBeOnTheScreen();
    expect(screen.getByText('박기사')).toBeOnTheScreen();
    expect(screen.getByText('010-9876-5432')).toBeOnTheScreen();
  });

  it('알림 설정은 바로 반영되고 다녀와도 남아 있다', async () => {
    await openMyPage();

    await userEvent.press(button('알림 설정'));
    await userEvent.press(
      screen.getByRole('switch', { name: '일정 변경 알림' }),
    );
    await userEvent.press(button('뒤로 가기'));
    await userEvent.press(button('알림 설정'));

    expect(
      screen.getByRole('switch', { name: '일정 변경 알림' }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('switch', { name: '작업 배정 알림' }),
    ).toBeChecked();
  });

  it('알림센터에서 읽지 않은 알림을 누르면 흰 배경이 되고, 다녀와도 읽음이다', async () => {
    await openMyPage();

    await userEvent.press(button('알림센터'));
    const unread = () => screen.getAllByRole('button', { name: /^읽지 않음/ });
    const before = unread().length;
    await userEvent.press(unread()[0]);
    expect(unread()).toHaveLength(before - 1);

    await userEvent.press(button('뒤로 가기'));
    await userEvent.press(button('알림센터'));
    expect(unread()).toHaveLength(before - 1);
  });

  it('약관 주소가 아직 없어 약관 행은 비활성이고 앱 버전을 보여준다', async () => {
    await openMyPage();

    await userEvent.press(button('약관 및 앱 정보'));

    expect(button('서비스 이용약관')).toBeDisabled();
    expect(screen.getByText('현재 버전 1.0')).toBeOnTheScreen();
  });

  it('로그아웃을 확인하면 첫 화면(홈)으로 돌아간다', async () => {
    const alert = spyAlert();
    await openMyPage();

    await userEvent.press(button('계정 관리'));
    await userEvent.press(button('로그아웃'));
    await pressAlertButton(alert, '로그아웃');

    expect(header('내 작업')).toBeOnTheScreen();
    expect(tab('홈')).toBeSelected();
    expect(header('계정 관리')).not.toBeOnTheScreen();
  });

  describe('계정 탈퇴', () => {
    it('응답 필요 요청이 있으면 탈퇴 불가로 가고, > 를 누르면 내 일정의 응답 필요로 간다', async () => {
      await openMyPage();

      await userEvent.press(button('계정 관리'));
      await userEvent.press(button('계정 탈퇴'));

      expect(
        await screen.findByRole('header', { name: '계정 탈퇴 불가' }),
      ).toBeOnTheScreen();
      // 있는 사유만 카드로 보인다 (작업을 시작하지 않았다)
      expect(
        screen.queryByTestId('withdrawal-block-WORK_IN_PROGRESS'),
      ).toBeNull();
      expect(
        screen.getByTestId('withdrawal-block-WORK_PENDING_ACCEPT'),
      ).toBeOnTheScreen();
      await userEvent.press(button(/^미완료 작업 배정 \d+건 보기$/));

      expect(header('내 일정')).toBeOnTheScreen();
      expect(tab('내 일정')).toBeSelected();
      expect(screen.getByRole('tab', { name: /^응답 필요/ })).toBeSelected();
    });

    it('응답 필요를 정리하고 돌아오면 탈퇴 불가 화면의 사유도 바뀐다', async () => {
      await openMyPage();
      await userEvent.press(button('계정 관리'));
      await userEvent.press(button('계정 탈퇴'));
      await userEvent.press(
        await screen.findByRole('button', { name: /^미완료 작업 배정/ }),
      );

      while (screen.queryAllByRole('button', { name: /수락$/ }).length > 0) {
        await userEvent.press(
          screen.getAllByRole('button', { name: /수락$/ })[0],
        );
      }
      await userEvent.press(tab('마이'));

      expect(header('계정 탈퇴 불가')).toBeOnTheScreen();
      expect(
        screen.queryByTestId('withdrawal-block-WORK_PENDING_ACCEPT'),
      ).toBeNull();
      expect(
        screen.getByText(
          '지금은 탈퇴를 막는 사유가 없어요. 계정 관리에서 다시 시도해 주세요.',
        ),
      ).toBeOnTheScreen();
    });

    it('진행 중인 작업이 있으면 그 사유도 보이고, > 를 누르면 홈으로 간다', async () => {
      await render(<App />);
      await userEvent.press(button('작업 시작'));
      await userEvent.press(tab('마이'));

      await userEvent.press(button('계정 관리'));
      await userEvent.press(button('계정 탈퇴'));
      await userEvent.press(
        await screen.findByRole('button', {
          name: '진행 중인 작업 1건 보기',
        }),
      );

      expect(header('내 작업')).toBeOnTheScreen();
      expect(tab('홈')).toBeSelected();
    });

    it('막는 사유가 없으면 계정 탈퇴로 가고, 최종 확인 뒤 첫 화면으로 돌아간다', async () => {
      const alert = spyAlert();
      await render(<App />);
      // 응답 필요 요청을 모두 수락해 탈퇴를 막는 사유를 없앤다
      await userEvent.press(tab('내 일정'));
      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
      while (screen.queryAllByRole('button', { name: /수락$/ }).length > 0) {
        await userEvent.press(
          screen.getAllByRole('button', { name: /수락$/ })[0],
        );
      }
      await userEvent.press(tab('마이'));

      await userEvent.press(button('계정 관리'));
      await userEvent.press(button('계정 탈퇴'));
      expect(
        await screen.findByRole('header', {
          name: '정말 Orbit을 탈퇴하시겠습니까?',
        }),
      ).toBeOnTheScreen();
      expect(tab('마이')).toBeSelected();

      await userEvent.press(button('탈퇴하기'));
      await pressAlertButton(alert, '탈퇴');

      expect(header('내 작업')).toBeOnTheScreen();
      expect(tab('홈')).toBeSelected();
    });
  });

  describe('하위 화면 공통', () => {
    // 네이티브 화면은 받는 영역(start ≤ x ≤ end) 밖의 스와이프를 거절한다
    const swipeArea = (title: string) => {
      let node = screen.getByRole('header', { name: title }).parent;
      while (node && !node.props.gestureResponseDistance) {
        node = node.parent;
      }
      return node?.props.gestureResponseDistance;
    };

    it.each(subScreens)(
      '%s → %s 도 iOS 스와이프는 왼쪽 1/3 에서만 받는다',
      async (name, title) => {
        await openMyPage();

        await userEvent.press(button(name));

        expect(swipeArea(title)).toEqual(
          expect.objectContaining({
            start: -1,
            end: Dimensions.get('window').width / 3,
          }),
        );
      },
    );

    it.each(subScreens)(
      '%s → %s 에서 두 손가락 Z 로 마이페이지에 돌아온다',
      async (name, title) => {
        await openMyPage();
        expect(escapeTarget('마이페이지')).toBeNull();

        await userEvent.press(button(name));
        await escapeFrom(title);

        expect(header('마이페이지')).toBeOnTheScreen();
        expect(header(title)).not.toBeOnTheScreen();
      },
    );

    it.each(subScreens)(
      '%s → %s 가 열리면 전환이 끝난 뒤 스크린리더 포커스가 제목으로 간다',
      async (name, title) => {
        const focus = jest
          .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
          .mockClear();
        await openMyPage();

        await userEvent.press(button(name));
        expect(focus).not.toHaveBeenCalled();
        await fireEvent(screen.getByRole('header', { name: title }), 'appear');

        expect(focus).toHaveBeenCalledWith(
          expect.objectContaining({
            props: expect.objectContaining({ children: title }),
          }),
          'focus',
        );
      },
    );

    it('Android 뒤로가기: 하위 화면은 마이페이지로, 마이페이지는 홈 탭으로 간다', async () => {
      type Handler = Parameters<typeof BackHandler.addEventListener>[1];
      const handlers = new Set<Handler>();
      jest
        .spyOn(BackHandler, 'addEventListener')
        .mockImplementation((_event, handler) => {
          handlers.add(handler);
          return { remove: () => handlers.delete(handler) };
        });
      const pressBack = async () => {
        let handled = false;
        await act(() => {
          handled = [...handlers]
            .reverse()
            .some(handler => handler(undefined as never) === true);
        });
        return handled;
      };
      await openMyPage();
      await userEvent.press(button('계정 관리'));

      expect(await pressBack()).toBe(true);
      expect(header('마이페이지')).toBeOnTheScreen();

      expect(await pressBack()).toBe(true);
      await waitFor(() => expect(tab('홈')).toBeSelected());
      expect(header('내 작업')).toBeOnTheScreen();
    });

    // 계정 관리 아래의 두 화면도 같은 스택 설정을 쓴다
    const deepScreens = [
      ['계정 탈퇴', '정말 Orbit을 탈퇴하시겠습니까?'],
      ['계정 탈퇴 불가', '계정 탈퇴 불가'],
    ] as const;
    // 응답 필요 요청을 모두 수락했는지에 따라 계정 탈퇴·탈퇴 불가로 간다
    async function openDeep(name: (typeof deepScreens)[number][0]) {
      await render(<App />);
      if (name === '계정 탈퇴') {
        await userEvent.press(tab('내 일정'));
        await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
        while (screen.queryAllByRole('button', { name: /수락$/ }).length > 0) {
          await userEvent.press(
            screen.getAllByRole('button', { name: /수락$/ })[0],
          );
        }
      }
      await userEvent.press(tab('마이'));
      await userEvent.press(button('계정 관리'));
      await userEvent.press(button('계정 탈퇴'));
    }

    it.each(deepScreens)(
      '%s 도 스와이프는 왼쪽 1/3, 열리면 제목 포커스, 두 손가락 Z 로 계정 관리에 돌아온다',
      async (name, title) => {
        const focus = jest
          .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
          .mockClear();
        await openDeep(name);
        const opened = await screen.findByRole('header', { name: title });

        expect(swipeArea(title)).toEqual(
          expect.objectContaining({
            start: -1,
            end: Dimensions.get('window').width / 3,
          }),
        );
        await fireEvent(opened, 'appear');
        expect(focus).toHaveBeenLastCalledWith(
          expect.objectContaining({
            props: expect.objectContaining({ accessibilityRole: 'header' }),
          }),
          'focus',
        );

        await escapeFrom(title);
        expect(header('계정 관리')).toBeOnTheScreen();
        expect(header(title)).not.toBeOnTheScreen();
      },
    );

    it('하위 화면에서 마이 탭을 다시 누르면 마이페이지로 돌아간다', async () => {
      await openMyPage();

      await userEvent.press(button('계정 관리'));
      await userEvent.press(tab('마이'));

      expect(
        await screen.findByRole('header', { name: '마이페이지' }),
      ).toBeOnTheScreen();
      expect(header('계정 관리')).not.toBeOnTheScreen();
    });
  });
});
