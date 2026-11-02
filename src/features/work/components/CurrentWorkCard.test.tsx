import { render, screen, userEvent } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { colors, fonts } from '../../../shared/design-system';
import { iconSvgs } from '../../../shared/design-system/icons/svgs';
import { currentWork } from '../mockData';
import { CurrentWorkCard, NoCurrentWorkCard } from './CurrentWorkCard';

// Figma 메인화면의 진행 작업 카드 틀. 작업이 있을 때와 없을 때 같은 프레임이다
const cardFrame = {
  paddingVertical: 24,
  paddingHorizontal: 20,
  borderRadius: 18,
  boxShadow: '0px 1px 18px rgba(119, 107, 168, 0.12)',
};

describe('CurrentWorkCard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('작업명, 시간, 고객·주소를 보여준다', async () => {
    await render(
      <CurrentWorkCard
        work={currentWork}
        started={false}
        onStart={jest.fn()}
        onOpen={jest.fn()}
      />,
    );

    expect(screen.getByText('보일러 점검')).toBeOnTheScreen();
    expect(screen.getByText('11:00 -12:00')).toBeOnTheScreen();
    expect(screen.getByText('이수연')).toBeOnTheScreen();
    expect(screen.getByText('서울 송파구 올림픽로 88')).toBeOnTheScreen();
  });

  it('렌치 아이콘 없이 작업명 줄이 카드 머리의 왼쪽부터 시작하고 오른쪽 끝에 > 가 있다', async () => {
    const { container } = await render(
      <CurrentWorkCard
        work={currentWork}
        started={false}
        onStart={jest.fn()}
        onOpen={jest.fn()}
      />,
    );

    expect(container.queryAll(node => node.type === 'Image')).toHaveLength(0);
    const header = screen.getByRole('button', {
      name: '보일러 점검 상세 보기',
    });
    expect(header).toHaveStyle({ flexDirection: 'row' });
    const first = header.children[0];
    const last = header.children[header.children.length - 1];
    expect(first).toHaveTextContent(/^보일러 점검/);
    const pathsOf = (xml: string) =>
      [...xml.matchAll(/ d="([^"]+)"/g)].map(([, d]) => d);
    expect(
      typeof last === 'string'
        ? last
        : last
            .queryAll(node => typeof node.props.d === 'string')
            .map(node => node.props.d),
    ).toEqual(pathsOf(iconSvgs['chevron-right'].xml));
  });

  it('고객·주소 줄은 Figma 대로 14pt 행간 140% 이고 고객은 Medium, 주소는 Regular, 사이 구분선은 Gray400 이다', async () => {
    await render(
      <CurrentWorkCard
        work={currentWork}
        started={false}
        onStart={jest.fn()}
        onOpen={jest.fn()}
      />,
    );

    expect(screen.getByText('이수연')).toHaveStyle({
      fontFamily: fonts.medium,
      fontSize: 14,
      lineHeight: 19.6,
      color: colors.gray[800],
    });
    expect(screen.getByText('서울 송파구 올림픽로 88')).toHaveStyle({
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 19.6,
      color: colors.gray[800],
    });
    expect(screen.getByText('이수연').parent?.children[1]).toHaveStyle({
      width: 1,
      height: 12,
      backgroundColor: colors.gray[400],
    });
  });

  it('카드 틀은 Figma 대로 위아래 24·좌우 20 여백, 모서리 18, 보랏빛 그림자다', async () => {
    await render(
      <CurrentWorkCard
        work={currentWork}
        started={false}
        onStart={jest.fn()}
        onOpen={jest.fn()}
      />,
    );

    const card = screen.getByRole('button', {
      name: '보일러 점검 상세 보기',
    }).parent;
    expect(card).toHaveStyle({
      ...cardFrame,
      gap: 22,
      backgroundColor: colors.white[100],
    });
  });

  it('boxShadow 를 못 그리는 Android 8.1 이하에서는 같은 그림자를 겹친 사각형으로 깐다', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(27);
    await render(
      <CurrentWorkCard
        work={currentWork}
        started={false}
        onStart={jest.fn()}
        onOpen={jest.fn()}
      />,
    );

    const card = screen.getByRole('button', {
      name: '보일러 점검 상세 보기',
    }).parent;
    expect(card).toHaveStyle({ borderRadius: 18 });
    expect(StyleSheet.flatten(card?.props.style).boxShadow).toBeUndefined();
    expect(card?.parent?.children.length).toBeGreaterThan(1);
  });

  it('시작 전이면 Secondary "작업 시작" CTA 로 onStart 를 호출한다', async () => {
    const onStart = jest.fn();
    await render(
      <CurrentWorkCard
        work={currentWork}
        started={false}
        onStart={onStart}
        onOpen={jest.fn()}
      />,
    );

    const cta = screen.getByRole('button', { name: '작업 시작' });
    expect(cta).toHaveStyle({ backgroundColor: colors.secondary });
    await userEvent.press(cta);

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('시작 후에는 Primary "작업 수행중" CTA 로 상세를 연다', async () => {
    const onOpen = jest.fn();
    await render(
      <CurrentWorkCard
        work={currentWork}
        started
        onStart={jest.fn()}
        onOpen={onOpen}
      />,
    );

    const cta = screen.getByRole('button', { name: '작업 수행중' });
    expect(cta).toHaveStyle({ backgroundColor: colors.primary });
    await userEvent.press(cta);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('카드 머리(작업명 줄)를 누르면 상세를 연다', async () => {
    const onOpen = jest.fn();
    await render(
      <CurrentWorkCard
        work={currentWork}
        started={false}
        onStart={jest.fn()}
        onOpen={onOpen}
      />,
    );

    await userEvent.press(
      screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
    );

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('NoCurrentWorkCard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('같은 틀의 Primary 카드에 흐린 글씨로 안내하고, 누를 수 없다', async () => {
    await render(<NoCurrentWorkCard />);

    const text = screen.getByText('현재 진행 중인 작업이 없습니다');
    expect(text).toHaveStyle({ color: colors.white[60] });
    expect(text.parent).toHaveStyle({
      ...cardFrame,
      backgroundColor: colors.primary,
    });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('boxShadow 를 못 그리는 Android 8.1 이하에서도 같은 그림자를 겹친 사각형으로 깐다', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(27);
    await render(<NoCurrentWorkCard />);

    const card = screen.getByText('현재 진행 중인 작업이 없습니다').parent;
    expect(card).toHaveStyle({ borderRadius: 18 });
    expect(StyleSheet.flatten(card?.props.style).boxShadow).toBeUndefined();
    expect(card?.parent?.children.length).toBeGreaterThan(1);
  });
});
