import { act, render, screen, userEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { appStorage } from '../shared/storage/appStorage';
import App from './App';
import { NAVIGATION_STATE_KEY } from './navigation/persistence';

// #34 앱이 백그라운드에서 종료됐다가 다시 열려도 보던 화면과 작성 중인 입력을 복원한다.
// 테스트의 저장소는 react-native-mmkv 의 메모리 목이라, 앱을 언마운트하고 다시 렌더하면 '종료 후 다시 열기' 와 같다.
// Android 의 Activity 재생성(글꼴 크기 변경 등)도 JS 런타임은 남고 화면만 다시 마운트되므로 같은 경우다.
// 네이티브 스택은 아래 화면을 스크린리더에서만 숨기므로 "지금 보이는 화면" 은 헤더로 확인한다 (App.test 와 같다)
const header = (name: string) => screen.queryByRole('header', { name });
const tab = (name: string) => screen.getByRole('tab', { name });
const tabBar = () => screen.queryByRole('tab', { name: '홈' });

async function launch() {
  const { unmount } = await render(<App />);
  // 테스트 환경에서는 언마운트가 OS 의 앱 종료와 같다. 정리 코드만 돌고 내비게이션 동작은 일어나지 않는다
  return () => unmount();
}

async function relaunch(kill: () => Promise<void>) {
  await kill();
  return launch();
}

const openWorkDetail = () =>
  userEvent.press(
    screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
  );

async function writeReport() {
  await openWorkDetail();
  await userEvent.press(
    screen.getByRole('button', { name: '작업 전 사진 추가' }),
  );
  await userEvent.type(screen.getByLabelText('수행 메모 입력'), '배관 교체');
  await userEvent.type(screen.getByLabelText('결제 금액 입력'), '75000');
  await userEvent.press(screen.getByRole('button', { name: '결제 방식 선택' }));
  await userEvent.press(screen.getByRole('button', { name: '현장 카드' }));
}

async function openRejectFromRequestDetail() {
  await userEvent.press(tab('내 일정'));
  await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
  await userEvent.press(screen.getAllByRole('button', { name: / 상세,/ })[0]);
  await userEvent.press(screen.getByRole('button', { name: '거절' }));
}

const spyAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});
const pressAlertButton = (alert: ReturnType<typeof spyAlert>, text: string) =>
  act(() =>
    alert.mock.lastCall?.[2]?.find(item => item.text === text)?.onPress?.(),
  );

describe('App — 종료 후 다시 열기 (#34)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('처음 실행이면 첫 화면(홈)에서 시작한다', async () => {
    await launch();

    expect(header('내 작업')).toBeOnTheScreen();
    expect(tab('홈')).toBeSelected();
  });

  describe('작업 상세에서 완료 보고를 작성하던 중', () => {
    it('다시 열면 같은 작업 상세가 열리고 사진·메모·결제 정보가 남아 있다', async () => {
      const kill = await launch();
      await writeReport();

      await relaunch(kill);

      expect(header('작업 상세')).toBeOnTheScreen();
      expect(tab('홈')).toBeSelected();
      expect(screen.getByLabelText('수행 메모 입력')).toHaveDisplayValue(
        '배관 교체',
      );
      expect(screen.getByLabelText('결제 금액 입력')).toHaveDisplayValue(
        '75,000',
      );
      expect(
        screen.getByRole('button', { name: '결제 방식 선택' }),
      ).toHaveAccessibilityValue({ text: '현장 카드' });
      expect(
        screen.getByRole('button', { name: '작업 전 사진 추가' }),
      ).toHaveAccessibilityValue({ text: '1/6' });
    });

    it('이어 쓰는 보고도 나갈 때 묻고, 화면 스택도 남아 뒤로 가면 메인화면이다', async () => {
      const alert = spyAlert();
      const kill = await launch();
      await writeReport();
      await relaunch(kill);

      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(alert).toHaveBeenCalledTimes(1);

      await pressAlertButton(alert, '나가기');
      expect(header('내 작업')).toBeOnTheScreen();
      expect(header('작업 상세')).not.toBeOnTheScreen();
    });

    it('"나가기" 로 버린 초안은 다시 열어도 없다', async () => {
      const alert = spyAlert();
      const kill = await launch();
      await writeReport();
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      await pressAlertButton(alert, '나가기');

      await relaunch(kill);
      expect(header('내 작업')).toBeOnTheScreen();
      await openWorkDetail();
      expect(screen.getByLabelText('수행 메모 입력')).toHaveDisplayValue('');
    });

    it('제출한 보고는 초안에서 지운다', async () => {
      const kill = await launch();
      await writeReport();
      await userEvent.press(
        screen.getByRole('button', { name: '작업 후 사진 추가' }),
      );
      await userEvent.press(
        screen.getByRole('button', { name: '완료보고 제출' }),
      );
      await screen.findByRole('header', { name: '제출 완료' });

      await relaunch(kill);
      // 제출 기록은 API 연동 전까지 메모리에만 있어 다시 연 앱은 빈 보고로 연다. 초안이 되살아나지 않아야 한다
      expect(screen.getByLabelText('수행 메모 입력')).toHaveDisplayValue('');
    });
  });

  describe('내 일정 › 요청 상세 › 거절 사유에서 사유를 고르던 중', () => {
    it('다시 열면 같은 화면과 선택이 복원되고, 뒤로 가면 요청 상세 → 내 일정이다', async () => {
      const kill = await launch();
      await openRejectFromRequestDetail();
      await userEvent.press(
        screen.getByRole('radio', { name: '작업 위치가 너무 멉니다' }),
      );

      await relaunch(kill);

      expect(header('거절 사유')).toBeOnTheScreen();
      expect(tabBar()).not.toBeOnTheScreen();
      expect(
        screen.getByRole('radio', { name: '작업 위치가 너무 멉니다' }),
      ).toBeChecked();

      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(header('작업 상세')).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(header('내 일정')).toBeOnTheScreen();
      expect(tab('내 일정')).toBeSelected();
    });

    it('기타에 쓰던 글도 펼친 채로 복원한다', async () => {
      const kill = await launch();
      await openRejectFromRequestDetail();
      await userEvent.press(
        screen.getByRole('radio', { name: '기타 (직접 입력)' }),
      );
      await userEvent.type(
        screen.getByLabelText('기타 거절 사유 입력'),
        '차량 고장',
      );

      await relaunch(kill);

      expect(
        screen.getByRole('radio', { name: '기타 (직접 입력)' }),
      ).toBeChecked();
      expect(screen.getByLabelText('기타 거절 사유 입력')).toHaveDisplayValue(
        '차량 고장',
      );
    });

    it('화면을 나가면 고르던 사유를 지운다', async () => {
      const kill = await launch();
      await openRejectFromRequestDetail();
      await userEvent.press(
        screen.getByRole('radio', { name: '작업 위치가 너무 멉니다' }),
      );
      await userEvent.press(screen.getByRole('button', { name: '취소' }));

      await relaunch(kill);
      expect(header('작업 상세')).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('button', { name: '거절' }));
      expect(
        screen.getByRole('radio', { name: '작업 위치가 너무 멉니다' }),
      ).not.toBeChecked();
    });

    it('제출하면 고르던 사유를 지운다', async () => {
      const kill = await launch();
      await openRejectFromRequestDetail();
      await userEvent.press(
        screen.getByRole('radio', { name: '작업 위치가 너무 멉니다' }),
      );
      await userEvent.press(screen.getByRole('button', { name: '거절 제출' }));
      expect(header('내 일정')).toBeOnTheScreen();

      // 거절은 API 연동 전까지 메모리에만 있어 다시 연 앱에는 같은 요청이 남아 있다
      await relaunch(kill);
      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
      await userEvent.press(
        screen.getAllByRole('button', { name: / 상세,/ })[0],
      );
      await userEvent.press(screen.getByRole('button', { name: '거절' }));
      expect(
        screen.getByRole('radio', { name: '작업 위치가 너무 멉니다' }),
      ).not.toBeChecked();
    });
  });

  it('고른 탭과 탭마다 보던 화면을 복원한다', async () => {
    const kill = await launch();
    await openWorkDetail();
    await userEvent.press(tab('작업 이력'));

    await relaunch(kill);

    expect(tab('작업 이력')).toBeSelected();
    expect(header('작업 이력')).toBeOnTheScreen();
    await userEvent.press(tab('홈'));
    expect(header('작업 상세')).toBeOnTheScreen();
  });

  // 시작할 때 읽은 상태는 저장소에서 빼고(그리다 죽으면 다음엔 첫 화면), 다 그린 뒤 다시 남긴다
  it('복원한 화면에서 아무것도 하지 않고 또 종료돼도 다시 복원한다', async () => {
    let kill = await launch();
    await openWorkDetail();

    kill = await relaunch(kill);
    await relaunch(kill);

    expect(header('작업 상세')).toBeOnTheScreen();
  });

  it(`마지막으로 화면이 바뀐 지 12시간이 지났으면 첫 화면으로 시작하고, 작성하던 보고는 남아 있다`, async () => {
    const start = Date.now();
    const now = jest.spyOn(Date, 'now').mockReturnValue(start);
    const kill = await launch();
    await writeReport();

    now.mockReturnValue(start + 12 * 60 * 60 * 1000 + 1);
    await relaunch(kill);

    expect(header('내 작업')).toBeOnTheScreen();
    await openWorkDetail();
    expect(screen.getByLabelText('수행 메모 입력')).toHaveDisplayValue(
      '배관 교체',
    );
  });

  it('저장한 화면 구조가 지금 앱과 맞지 않으면(앱 업데이트 등) 첫 화면으로 시작한다', async () => {
    appStorage.set(
      NAVIGATION_STATE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        state: { index: 0, routes: [{ name: 'OldScreen' }] },
      }),
    );

    await launch();

    expect(header('내 작업')).toBeOnTheScreen();
    expect(tab('홈')).toBeSelected();
  });
});
