import { act, render, screen, userEvent } from '@testing-library/react-native';
import { BackHandler, FlatList } from 'react-native';
import App from './App';

// #71 하단 탭 '작업 이력'. 화면 자체는 WorkHistoryScreen.test 가 보고, 여기서는 탭·스택 연결을 본다.
// 네이티브 스택은 아래 화면을 스크린리더에서만 숨기므로 "지금 보이는 화면" 은 헤더로 확인한다 (App.test 와 같다)
const header = (name: string) => screen.queryByRole('header', { name });
const tab = (name: string) => screen.getByRole('tab', { name });
const rows = () => screen.getAllByRole('button', { name: /, 완료, / });

// 목 데이터는 앱을 연 날을 기준으로 만든다
const monthTitle = (offset: number) => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
};

async function openHistory() {
  await render(<App />);
  await userEvent.press(tab('작업 이력'));
}

describe('App — 작업 이력 탭', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('하단 탭 "작업 이력" 을 누르면 작업 이력 화면이 열리고 탭이 활성이다', async () => {
    await openHistory();

    expect(header('작업 이력')).toBeOnTheScreen();
    expect(header('내 작업')).not.toBeOnTheScreen();
    expect(tab('작업 이력')).toBeSelected();
    expect(screen.getByText(monthTitle(0))).toBeOnTheScreen();
  });

  it('작업 이력 화면에서 탭을 다시 누르면 목록이 맨 위로 간다', async () => {
    // 테스트 환경의 리스트는 스크롤 위치가 없어 맨 위로 보내는 호출로 확인한다
    const scroll = jest.spyOn(FlatList.prototype, 'scrollToOffset');
    await openHistory();

    await userEvent.press(tab('작업 이력'));
    // 탭 다시 누름 처리는 다음 프레임에 돈다
    await act(() => new Promise(resolve => requestAnimationFrame(resolve)));

    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }));
  });

  it('행을 누르면 탭 바가 있는 그 작업의 상세가 열린다', async () => {
    await openHistory();
    await userEvent.press(screen.getByRole('button', { name: '이전 달' }));
    // 첫 행이 아닌 행을 눌러 id 로 그 작업을 찾는지 본다
    const row = rows()[1];
    const [title, , when] = row.props.accessibilityLabel.split(', ');
    const [, year, month, day, weekday] =
      /^(\d+)년 (\d+)월 (\d+)일 (.)요일/.exec(when) ?? [];

    await userEvent.press(row);

    expect(header('작업 상세')).toBeOnTheScreen();
    expect(header('작업 이력')).not.toBeOnTheScreen();
    expect(tab('작업 이력')).toBeSelected();
    expect(screen.getByText(title)).toBeOnTheScreen();
    expect(
      screen.getByText(
        `${year}-${month.padStart(2, '0')}-${day.padStart(
          2,
          '0',
        )} (${weekday})`,
      ),
    ).toBeOnTheScreen();
  });

  it('작업 이력에서 연 상세는 제출 후 읽기 전용이다', async () => {
    await openHistory();

    await userEvent.press(rows()[0]);

    expect(header('작업 상세')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '제출 완료' })).toBeDisabled();
    expect(
      screen.getByText(/^제출 시각 \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('결제 금액 입력')).toHaveProp(
      'editable',
      false,
    );
    expect(screen.getByLabelText('수행 메모 입력')).toHaveProp(
      'editable',
      false,
    );
    expect(
      screen.getByRole('button', { name: '작업 전 사진 추가' }),
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: '완료보고 제출' }),
    ).not.toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: '완료 보고 작성하기' }),
    ).not.toBeOnTheScreen();
  });

  it('상세에서 뒤로 오면 고른 달과 같은 목록(스크롤 위치)이 그대로다', async () => {
    const scroll = jest.spyOn(FlatList.prototype, 'scrollToOffset');
    await openHistory();
    await userEvent.press(screen.getByRole('button', { name: '이전 달' }));
    const list = screen.getByTestId('work-history-list');

    await userEvent.press(rows()[0]);
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(header('작업 이력')).toBeOnTheScreen();
    expect(screen.getByText(monthTitle(-1))).toBeOnTheScreen();
    // 목록 화면은 상세 아래에 마운트된 채 남는다. 같은 리스트이고 맨 위로 보내지 않았으니 스크롤 위치도 그대로다
    expect(screen.getByTestId('work-history-list')).toBe(list);
    expect(scroll).not.toHaveBeenCalled();
  });

  it('상세에서 지금 탭("작업 이력")을 다시 누르면 목록으로 돌아간다', async () => {
    await openHistory();
    await userEvent.press(rows()[0]);

    await userEvent.press(tab('작업 이력'));

    expect(
      await screen.findByRole('header', { name: '작업 이력' }),
    ).toBeOnTheScreen();
    expect(header('작업 상세')).not.toBeOnTheScreen();
  });

  it('홈에 다녀와도 작업 이력에서 고른 달이 남아 있다', async () => {
    await openHistory();
    await userEvent.press(screen.getByRole('button', { name: '이전 달' }));

    await userEvent.press(tab('홈'));
    await userEvent.press(tab('작업 이력'));

    expect(screen.getByText(monthTitle(-1))).toBeOnTheScreen();
  });

  it('Android 뒤로가기: 작업 이력 상세에서는 목록으로, 목록에서는 홈 탭으로 간다', async () => {
    type Handler = Parameters<typeof BackHandler.addEventListener>[1];
    const handlers = new Set<Handler>();
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        handlers.add(handler);
        return { remove: () => handlers.delete(handler) };
      });
    const pressBack = () =>
      act(() => {
        // RN BackHandler 처럼 나중에 등록한 핸들러부터 부르고, 하나가 처리하면 멈춘다. 이벤트 인자는 쓰지 않는다
        [...handlers]
          .reverse()
          .some(handler => handler(undefined as never) === true);
      });
    await openHistory();
    await userEvent.press(rows()[0]);

    await pressBack();
    expect(header('작업 이력')).toBeOnTheScreen();
    expect(header('작업 상세')).not.toBeOnTheScreen();

    await pressBack();
    expect(tab('홈')).toBeSelected();
    expect(header('내 작업')).toBeOnTheScreen();
  });
});
