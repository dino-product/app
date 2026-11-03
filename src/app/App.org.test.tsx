import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions, NativeModules } from 'react-native';
import { escapeFrom } from '../../jest/voiceOver';
import App from './App';

// 마이 › 조직 참여 (#73). "지금 보이는 화면" 은 헤더가 접근성 트리에 있는지로 확인한다 (App.test 와 같은 방식)
const header = (name: string) => screen.queryByRole('header', { name });
const tab = (name: string) => screen.getByRole('tab', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });

// 바텀시트 애니메이션(프리셋의 네이티브 애니메이션 목)은 테스트가 끝낸다
let runningAnimations: Array<(result: { finished: boolean }) => void> = [];
const finishAnimations = () =>
  act(() => {
    runningAnimations.splice(0).forEach(end => end({ finished: true }));
  });

async function openMyPage() {
  await render(<App />);
  await userEvent.press(tab('마이'));
}

async function findCompany(code: string) {
  await userEvent.type(screen.getByLabelText('회사 코드 입력'), code);
  await userEvent.press(button('회사 확인'));
}

describe('App — 조직 참여', () => {
  beforeEach(() => {
    runningAnimations = [];
    jest
      .spyOn(NativeModules.NativeAnimatedModule, 'startAnimatingNode')
      .mockImplementation((...args: unknown[]) => {
        runningAnimations.push(
          args[3] as (result: { finished: boolean }) => void,
        );
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('마이페이지의 신청 현황 배지는 승인 대기 건수와 같다', async () => {
    await openMyPage();

    await userEvent.press(button('신청 현황, 2건'));

    expect(header('참여 신청 현황')).toBeOnTheScreen();
    expect(header('승인 대기 2')).toBeOnTheScreen();
    expect(tab('마이')).toBeSelected();
  });

  it('마이페이지의 조직 참여와 신청 현황의 조직 참여하기로 회사 찾기가 열린다', async () => {
    await openMyPage();

    await userEvent.press(button('조직 참여'));
    expect(header('회사 찾기')).toBeOnTheScreen();
    await userEvent.press(button('뒤로 가기'));

    await userEvent.press(button('신청 현황, 2건'));
    await userEvent.press(button('조직 참여하기'));
    expect(header('회사 찾기')).toBeOnTheScreen();
  });

  it('코드로 회사를 찾아 기사로 요청하면 요청 완료가 보이고, 확인하면 마이페이지에 배지가 하나 늘어 있다', async () => {
    await openMyPage();
    await userEvent.press(button('조직 참여'));

    await findCompany('Orbit1245');
    expect(
      await screen.findByRole('header', { name: '역할을 선택해주세요' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Orbit')).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('radio', { name: /^기사/ }));
    await userEvent.press(button('참여 요청하기'));

    expect(header('참여 요청을 보냈어요')).toBeOnTheScreen();
    expect(screen.getByLabelText('회사, Orbit')).toBeOnTheScreen();
    expect(screen.getByLabelText('희망 유형, 기사')).toBeOnTheScreen();
    expect(screen.getByLabelText('요청 경로, 회사 코드')).toBeOnTheScreen();

    await userEvent.press(button('확인'));
    expect(header('마이페이지')).toBeOnTheScreen();
    expect(button('신청 현황, 3건')).toBeOnTheScreen();
  });

  // 요청을 다시 보내지 않게 회사 찾기·역할 선택은 스택에서 뺀다
  it('요청 완료에서 뒤로 가면 회사 찾기가 아니라 처음 연 화면으로 돌아간다', async () => {
    await openMyPage();
    await userEvent.press(button('조직 참여'));
    await findCompany('Orbit1245');
    await userEvent.press(await screen.findByRole('radio', { name: /^직원/ }));
    await userEvent.press(button('참여 요청하기'));

    await userEvent.press(button('뒤로 가기'));

    expect(header('마이페이지')).toBeOnTheScreen();
    expect(header('회사 찾기')).toBeNull();
  });

  it('요청 완료에서 신청 취소를 확정하면 마이페이지로 돌아가고 배지는 그대로다', async () => {
    await openMyPage();
    await userEvent.press(button('조직 참여'));
    await findCompany('Orbit1245');
    await userEvent.press(await screen.findByRole('radio', { name: /^기사/ }));
    await userEvent.press(button('참여 요청하기'));

    await userEvent.press(button('신청 취소'));
    expect(header('Orbit 참여 신청을 취소할까요?')).toBeOnTheScreen();
    await userEvent.press(button('취소'));
    await finishAnimations();

    expect(header('마이페이지')).toBeOnTheScreen();
    expect(button('신청 현황, 2건')).toBeOnTheScreen();
  });

  it('이미 소속된 회사 코드면 모달을 띄우고, 확인하면 입력이 남는다', async () => {
    await openMyPage();
    await userEvent.press(button('조직 참여'));

    await findCompany('OBS0001');

    expect(
      await screen.findByRole('header', { name: '이미 참여 중인 회사예요' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '오빗 서비스에 이미 소속되어 있어\n참여 요청을 다시 보낼 수 없습니다.',
      ),
    ).toBeOnTheScreen();
    await userEvent.press(button('확인'));
    expect(header('이미 참여 중인 회사예요')).toBeNull();
    expect(screen.getByLabelText('회사 코드 입력')).toHaveDisplayValue(
      'OBS0001',
    );
  });

  it('유효하지 않은 코드면 제목이 회사 참여로 바뀐다', async () => {
    await openMyPage();
    await userEvent.press(button('조직 참여'));

    await findCompany('NOPE');

    expect(
      await screen.findByRole('header', { name: '회사 참여' }),
    ).toBeOnTheScreen();
    expect(header('유효하지 않은 회사 코드입니다')).toBeOnTheScreen();
  });

  it('신청 현황에서 취소하면 목록에서 빠지고, 마지막 건이면 빈 상태가 된다', async () => {
    await openMyPage();
    await userEvent.press(button('신청 현황, 2건'));

    for (const name of ['한빛 설비', '그린 테크']) {
      await userEvent.press(button(`${name} 신청 취소`));
      await userEvent.press(button('취소'));
      await finishAnimations();
    }

    expect(screen.getByText('참여 신청 내역이 없어요')).toBeOnTheScreen();
    await userEvent.press(button('뒤로 가기'));
    expect(button('신청 현황')).toBeOnTheScreen();
  });

  it('알림센터의 참여 거절 알림을 누르면 거절 사유가 보이고, 확인하면 알림센터로 돌아온다', async () => {
    await openMyPage();
    await userEvent.press(button('알림센터'));

    await userEvent.press(button(/참여 요청이 거절되었습니다/));

    expect(header('참여 요청이 거절되었어요')).toBeOnTheScreen();
    expect(
      screen.getByText('현재 기사 인원이 충분해 요청을 받지 않고 있어요.'),
    ).toBeOnTheScreen();
    await userEvent.press(button('확인'));
    expect(header('알림센터')).toBeOnTheScreen();
  });

  describe('하위 화면 공통', () => {
    const swipeArea = (title: string) => {
      let node = screen.getByRole('header', { name: title }).parent;
      while (node && !node.props.gestureResponseDistance) {
        node = node.parent;
      }
      return node?.props.gestureResponseDistance;
    };

    // [여는 방법, 스택 머리 제목, 화면을 알아볼 머리말]
    const screens = [
      ['회사 찾기', '조직 참여하기', '회사 찾기'],
      ['참여 신청 현황', '참여 신청 현황', '승인 대기 2'],
    ] as const;

    it.each(screens)(
      '%s 도 스와이프는 왼쪽 1/3, 열리면 제목 포커스, 두 손가락 Z 로 마이페이지에 돌아온다',
      async (name, title, marker) => {
        const focus = jest
          .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
          .mockClear();
        await openMyPage();
        await userEvent.press(
          button(name === '회사 찾기' ? '조직 참여' : '신청 현황, 2건'),
        );
        expect(header(marker)).toBeOnTheScreen();

        expect(swipeArea(title)).toEqual(
          expect.objectContaining({
            start: -1,
            end: Dimensions.get('window').width / 3,
          }),
        );
        await fireEvent(screen.getByRole('header', { name: title }), 'appear');
        expect(focus).toHaveBeenLastCalledWith(
          expect.objectContaining({
            props: expect.objectContaining({ children: title }),
          }),
          'focus',
        );

        await escapeFrom(title);
        expect(header('마이페이지')).toBeOnTheScreen();
      },
    );
  });
});
