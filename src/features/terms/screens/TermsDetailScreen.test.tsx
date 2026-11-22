import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet, VirtualizedList } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../../../shared/design-system';
import { noTermsAgreed } from '../../onboarding/model';
import { TermsAgreementScreen } from '../../onboarding/screens/TermsAgreementScreen';
import {
  createFakeServer,
  hang,
  rawResponse,
} from '../../../shared/testing/fakeServer';
import { renderWithApi } from '../../../shared/testing/renderWithApi';
import { expectOnlySkeletons } from '../../../shared/testing/skeleton';
import { termsDocumentUrl } from '../documents';
import { termsText, withTermsDocuments } from '../testing';
import { TERMS_LOAD_FAILED, termsDocumentQueryKey } from '../termsQueries';
import { toTermsBlocks } from '../termsText';
import {
  TermsDetailScreen,
  type TermsDetailSection,
} from './TermsDetailScreen';
import { RADIOS_ITEM } from './useAgreeJump';

// Figma 약관 상세 페이지 (51019:16927). 제목·안내 아래에 원격 전문을 보인다 (#192)
const SERVICE_TEXT = [
  'Orbit 서비스 이용약관',
  '',
  '제1조(목적)',
  '',
  '이 약관은 목적을 규정합니다.',
].join('\n');

const service: TermsDetailSection = {
  key: 'service',
  title: '서비스 이용약관',
  document: 'service',
};

async function renderDetail({
  sections = [service],
  server = withTermsDocuments(createFakeServer(), {
    service: termsText(SERVICE_TEXT),
  }),
}: {
  sections?: readonly TermsDetailSection[];
  server?: ReturnType<typeof createFakeServer>;
} = {}) {
  const onBack = jest.fn();
  const result = await renderWithApi(
    <TermsDetailScreen sections={sections} onBack={onBack} />,
    { server },
  );
  return { ...result, onBack };
}

describe('TermsDetailScreen', () => {
  it('전문을 받는 동안 본문 자리에 스켈레톤을 보이고, 도착하면 조 제목과 본문을 보인다', async () => {
    await renderDetail();

    expect(
      screen.getByRole('header', { name: '서비스 이용약관' }),
    ).toBeOnTheScreen();
    expectOnlySkeletons('terms-skeleton-service');

    expect(await screen.findByText('제1조(목적)')).toBeOnTheScreen();
    expect(screen.getByText('이 약관은 목적을 규정합니다.')).toBeOnTheScreen();
    // 전문 첫머리의 문서 이름은 큰 제목과 겹쳐 보이지 않는다 (Figma 본문은 제1조부터)
    expect(screen.queryByText('Orbit 서비스 이용약관')).not.toBeOnTheScreen();
    expect(screen.queryByLabelText('불러오는 중')).not.toBeOnTheScreen();
  });

  it('불러오지 못하면 안내와 다시 시도를 보이고, 다시 시도하면 전문을 보인다', async () => {
    const url = termsDocumentUrl('service');
    const { server } = await renderDetail({
      server: withTermsDocuments(createFakeServer(), {
        service: rawResponse(500, ''),
      }),
    });

    expect(await screen.findByText(TERMS_LOAD_FAILED)).toBeOnTheScreen();
    server.on('GET', url, termsText(SERVICE_TEXT));
    await userEvent.press(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('제1조(목적)')).toBeOnTheScreen();
    expect(screen.queryByText(TERMS_LOAD_FAILED)).not.toBeOnTheScreen();
  });

  it('안내 문구가 있으면 제목 아래에 보인다', async () => {
    await renderDetail({
      sections: [{ ...service, intro: '아래 내용을 읽어 주세요' }],
    });

    expect(screen.getByText('아래 내용을 읽어 주세요')).toBeOnTheScreen();
    await screen.findByText('제1조(목적)');
  });

  it('원격 전문이 없는 약관은 받지 않고 준비 중 안내를 보인다', async () => {
    const { server } = await renderDetail({
      sections: [{ key: 'location', title: '위치기반', document: null }],
    });

    expect(screen.getByText('약관 전문을 준비하고 있어요.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('불러오는 중')).not.toBeOnTheScreen();
    await waitFor(() => expect(server.calls).toHaveLength(0));
  });

  // Figma 약관 상세 제목(51019:16932)과 가입 약관 제목(3284:22332)은 둘 다 y132 다. 오갈 때 제목이 튀지 않게
  // 가입 단계 화면 관례(머리 아래 22, TermsAgreementScreen·OrgJoinScreen)와 같은 자리에 둔다 (#193)
  it('큰 제목은 가입 약관 제목과 같은 자리(머리 아래 22)다', async () => {
    const titleTop = () => {
      // jest 목은 안쪽 View 에 스타일을 넘기지 않아 스크롤 뷰의 contentContainerStyle 을 읽는다
      const [scroll] = screen.container.queryAll(
        node => node.type === 'RCTScrollView',
      );
      return StyleSheet.flatten(scroll.props.contentContainerStyle).paddingTop;
    };
    await render(
      <TermsAgreementScreen
        agreement={noTermsAgreed}
        onAgreeAll={jest.fn()}
        onOpenTerms={jest.fn()}
        onBack={jest.fn()}
        onSignUp={jest.fn()}
      />,
    );
    const agreementTop = titleTop();
    await screen.unmount();

    await renderDetail();

    expect(agreementTop).toBe(22);
    expect(titleTop()).toBe(agreementTop);
    await screen.findByText('제1조(목적)');
  });

  it('뒤로 가기를 누르면 알린다', async () => {
    const { onBack } = await renderDetail();

    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(onBack).toHaveBeenCalledTimes(1);
    await screen.findByText('제1조(목적)');
  });

  it('동의 상태를 주지 않으면(마이 › 약관) 라디오 없이 읽기만 한다', async () => {
    await renderDetail();

    await screen.findByText('제1조(목적)');
    expect(screen.queryByRole('radio')).not.toBeOnTheScreen();
  });

  // 가입 약관 상세 (#193). 전문 아래에 디자인 시스템 라디오로 동의·비동의를 고른다
  describe('동의 라디오', () => {
    const marketing: TermsDetailSection = {
      key: 'MARKETING',
      title: '(선택) 혜택 이벤트 알림 수신동의',
      document: 'marketing',
    };
    // 라디오 묶음(radiogroup)은 스크린리더가 한 요소로 읽지 않는 View 라 testID 로 찾고 이름은 props 로 본다
    const radiosOf = (key: string) =>
      within(screen.getByTestId(`terms-agreement-${key}`));

    async function renderAgreement(
      agreement: Readonly<Record<string, boolean>>,
      sections: readonly TermsDetailSection[] = [service],
    ) {
      const onAgreeChange = jest.fn();
      await renderWithApi(
        <TermsDetailScreen
          sections={sections}
          agreement={agreement}
          onAgreeChange={onAgreeChange}
          onBack={jest.fn()}
        />,
        { server: withTermsDocuments(createFakeServer()) },
      );
      return onAgreeChange;
    }

    it('전문 아래에 동의합니다·동의하지 않습니다 라디오가 있고, 동의하지 않은 약관은 동의하지 않습니다가 골라져 있다', async () => {
      await renderAgreement({ service: false });

      const radios = radiosOf('service');
      expect(
        screen.getByTestId('terms-agreement-service').props.accessibilityLabel,
      ).toBe('서비스 이용약관 동의 여부');
      expect(
        radios.getByRole('radio', { name: '서비스 이용약관, 동의합니다' }),
      ).not.toBeChecked();
      expect(
        radios.getByRole('radio', {
          name: '서비스 이용약관, 동의하지 않습니다',
        }),
      ).toBeChecked();
      await screen.findByText('제1조(service 목적)');
    });

    it('동의한 약관은 동의합니다가 골라져 있다', async () => {
      await renderAgreement({ service: true });

      expect(
        radiosOf('service').getByRole('radio', {
          name: '서비스 이용약관, 동의합니다',
        }),
      ).toBeChecked();
      await screen.findByText('제1조(service 목적)');
    });

    it('라디오를 고르면 그 약관의 동의 상태를 알린다', async () => {
      const onAgreeChange = await renderAgreement({ service: false });
      const radios = radiosOf('service');

      await userEvent.press(
        radios.getByRole('radio', { name: '서비스 이용약관, 동의합니다' }),
      );
      expect(onAgreeChange).toHaveBeenLastCalledWith('service', true);

      await userEvent.press(
        radios.getByRole('radio', {
          name: '서비스 이용약관, 동의하지 않습니다',
        }),
      );
      expect(onAgreeChange).toHaveBeenLastCalledWith('service', false);
      await screen.findByText('제1조(service 목적)');
    });

    it('여러 약관이면 약관마다 제목·전문·라디오를 차례로 보인다', async () => {
      const onAgreeChange = await renderAgreement(
        { service: true, MARKETING: true },
        [service, marketing],
      );

      expect(
        screen.getAllByRole('header').map(header => header.props.children),
      ).toEqual(['서비스 이용약관', '(선택) 혜택 이벤트 알림 수신동의']);
      expect(
        await screen.findByText('제1조(marketing 목적)'),
      ).toBeOnTheScreen();
      expect(screen.getByText('제1조(service 목적)')).toBeOnTheScreen();

      await userEvent.press(
        radiosOf('MARKETING').getByRole('radio', {
          name: '(선택) 혜택 이벤트 알림 수신동의, 동의하지 않습니다',
        }),
      );
      expect(onAgreeChange).toHaveBeenLastCalledWith('MARKETING', false);
    });

    // VoiceOver 는 radiogroup 이름을 읽지 않아, 여러 약관 페이지에서 '동의합니다' 가 같은 이름으로 여럿 나오지 않게 한다
    it('라디오는 약관 제목을 붙여 읽고, 보이는 라벨은 동의합니다·동의하지 않습니다 그대로다', async () => {
      await renderAgreement({ service: true, MARKETING: false }, [
        service,
        marketing,
      ]);

      expect(
        screen
          .getAllByRole('radio')
          .map(radio => radio.props.accessibilityLabel),
      ).toEqual([
        '서비스 이용약관, 동의합니다',
        '서비스 이용약관, 동의하지 않습니다',
        '(선택) 혜택 이벤트 알림 수신동의, 동의합니다',
        '(선택) 혜택 이벤트 알림 수신동의, 동의하지 않습니다',
      ]);
      expect(screen.getAllByText('동의합니다')).toHaveLength(2);
      await screen.findByText('제1조(marketing 목적)');
    });
  });

  // #218 사용자 요청: 작업 상세 '완료 보고 작성하기' 앵커와 같은 모양(Secondary 채움·#F0F0F0 그라데이션·카툰 등장)의
  // '약관 동의하기' 를 두고, 누르면 동의 라디오로 스크롤한 다음 '동의합니다' 를 고른다
  describe('약관 동의하기 앵커 (#218)', () => {
    // 덩어리 6개 [제1조, 본문1, 제2조, 본문2, 제3조, 본문3] + 동의 라디오 = 약관 칸 7개
    const ARTICLES_TEXT = [
      'Orbit 서비스 이용약관',
      '',
      '제1조(목적)',
      '',
      '본문 1.',
      '',
      '제2조(정의)',
      '',
      '본문 2.',
      '',
      '제3조(효력)',
      '',
      '본문 3.',
    ].join('\n');
    const RADIOS = 6;
    const marketing: TermsDetailSection = {
      key: 'MARKETING',
      title: '(선택) 혜택 이벤트 알림 수신동의',
      document: 'marketing',
    };
    const server = () =>
      withTermsDocuments(createFakeServer(), {
        service: termsText(ARTICLES_TEXT),
        marketing: termsText('마케팅 동의\n\n본문입니다.'),
      });
    // 스크린리더 이름은 어느 약관인지 앞에 붙이고 보이는 글자를 그대로 담는다 (음성 제어로 '약관 동의하기' 를 말해도 찾는다)
    const jumpButton = (name = '서비스 이용약관, 약관 동의하기') =>
      screen.queryByRole('button', { name });

    // SectionList 가 실제로 고른 칸(펼친 순서)을 본다. 마지막 스크롤이 간 칸과 그 칸의 위치 옵션
    let scrollToIndex: jest.SpyInstance;
    const lastScroll = () => {
      const [params] = scrollToIndex.mock.lastCall ?? [];
      const props = list().props;
      return { ...params, item: props.getItem(props.data, params?.index) };
    };
    let focus: jest.SpyInstance;
    beforeEach(() => {
      scrollToIndex = jest
        .spyOn(VirtualizedList.prototype, 'scrollToIndex')
        .mockImplementation(() => {});
      focus = jest
        .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
        .mockImplementation(() => {});
    });
    afterEach(() => {
      jest.restoreAllMocks();
      jest.useRealTimers();
    });

    async function renderSignUp({
      sections = [service],
      agreement = { service: false },
      standalone = false,
      bottomInset = 0,
      fakeServer = server(),
      waitForText = true,
    }: {
      sections?: readonly TermsDetailSection[];
      agreement?: Readonly<Record<string, boolean>>;
      standalone?: boolean;
      /** 기기 아래 안전 영역 (홈 인디케이터) */
      bottomInset?: number;
      fakeServer?: ReturnType<typeof createFakeServer>;
      waitForText?: boolean;
    } = {}) {
      const onAgreeChange = jest.fn();
      const result = await renderWithApi(
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 393, height: 852 },
            insets: { top: 0, bottom: bottomInset, left: 0, right: 0 },
          }}
        >
          <TermsDetailScreen
            sections={sections}
            agreement={agreement}
            onAgreeChange={onAgreeChange}
            standalone={standalone}
            onBack={jest.fn()}
          />
        </SafeAreaProvider>,
        { server: fakeServer },
      );
      if (waitForText) {
        await screen.findByText('본문 1.');
      }
      return { onAgreeChange, queryClient: result.queryClient };
    }

    /** 누른 뒤 목록이 아직 재지 않은 칸이라 갈 수 없다고 알린다 (그려 둔 끝 칸: highest) */
    const failScroll = (highest: number) =>
      act(() =>
        list().props.onScrollToIndexFailed({
          index: flatIndex(0, RADIOS),
          highestMeasuredFrameIndex: highest,
          averageItemLength: 40,
        }),
      );

    it('아직 동의하지 않은 약관의 본문을 읽는 중이면 약관 동의하기 버튼이 나타난다', async () => {
      await renderSignUp();
      // 열자마자는 읽는 자리를 모른다 (목록이 화면에 보이는 칸을 알려 주면 정한다)
      expect(jumpButton()).not.toBeOnTheScreen();

      await viewItems(0, [0, 1, 2]);

      const button = jumpButton();
      expect(button).toBeOnTheScreen();
      expect(button).toHaveTextContent('약관 동의하기');
    });

    it('작업 상세 완료 보고 앵커와 같은 Secondary(#6452FD) 채움 버튼과 #F0F0F0 그라데이션이다', async () => {
      await renderSignUp();
      await viewItems(0, [0, 1]);

      expect(jumpButton()).toHaveStyle({
        backgroundColor: colors.secondary,
      });
      expect(
        screen.getByTestId('terms-agree-jump-fade', {
          includeHiddenElements: true,
        }),
      ).toHaveStyle({
        height: 218,
        backgroundImage:
          'linear-gradient(to bottom, rgba(240, 240, 240, 0) 8.96%, rgba(240, 240, 240, 1) 83.84%)',
      });
    });

    it('하단 탭 없이 열리면(가입) 아래 안전 영역 위에 띄운다', async () => {
      await renderSignUp({ standalone: true, bottomInset: 34 });
      await viewItems(0, [0, 1]);

      expect(
        screen.getByTestId('terms-agree-jump', { includeHiddenElements: true }),
      ).toHaveStyle({ bottom: 16 + 34 });
    });

    it('동의 라디오가 화면에 다 보이면 숨는다', async () => {
      await renderSignUp();
      await viewItems(0, [0, 1]);

      await viewItems(0, [4, 5, RADIOS]);

      expect(jumpButton()).not.toBeOnTheScreen();
    });

    it('이미 동의한 약관은 버튼이 없다', async () => {
      await renderSignUp({ agreement: { service: true } });

      await viewItems(0, [0, 1, 2]);

      expect(jumpButton()).not.toBeOnTheScreen();
    });

    it('동의 상태가 없는 읽기 전용 상세(마이 › 약관)는 버튼이 없고 보이는 칸을 따지지 않는다', async () => {
      await renderWithApi(
        <TermsDetailScreen sections={[service]} onBack={jest.fn()} />,
        { server: server() },
      );
      await screen.findByText('본문 1.');

      expect(list().props.onViewableItemsChanged).toBeUndefined();
      expect(
        screen.queryByRole('button', { name: /동의하기/ }),
      ).not.toBeOnTheScreen();
    });

    // 라디오를 화면 아래(본문 끝 아래 여백 40 위)에 둔다. 위에는 약관 끝 글이 보인다
    it('누르면 그 약관의 동의 라디오가 화면 아래에 오도록 스크롤하고, 아직 고르지는 않는다', async () => {
      const { onAgreeChange } = await renderSignUp();
      await viewItems(0, [0, 1]);

      await userEvent.press(jumpButton()!);

      expect(lastScroll()).toEqual(
        expect.objectContaining({
          index: flatIndex(0, RADIOS),
          item: RADIOS_ITEM,
          viewPosition: 1,
          viewOffset: -40,
          animated: true,
        }),
      );
      expect(onAgreeChange).not.toHaveBeenCalled();
    });

    it('하단 탭 없이 열리면 아래 안전 영역만큼 더 띄운다', async () => {
      await renderSignUp({ standalone: true, bottomInset: 34 });
      await viewItems(0, [0, 1]);

      await userEvent.press(jumpButton()!);

      expect(lastScroll()).toEqual(
        expect.objectContaining({ item: RADIOS_ITEM, viewOffset: -(40 + 34) }),
      );
    });

    it('스크롤해 라디오가 다 보이면 동의합니다를 고르고 그 라디오로 스크린리더 초점을 옮긴다', async () => {
      const { onAgreeChange } = await renderSignUp();
      await viewItems(0, [0, 1]);
      await userEvent.press(jumpButton()!);

      await viewItems(0, [5, RADIOS]);

      expect(onAgreeChange).toHaveBeenCalledTimes(1);
      expect(onAgreeChange).toHaveBeenCalledWith('service', true);
      expect(focus).toHaveBeenLastCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({
            accessibilityRole: 'radio',
            accessibilityLabel: '서비스 이용약관, 동의합니다',
          }),
        }),
        'focus',
      );

      // 한 번 고르면 끝이다. 다시 보여도 또 고르지 않는다
      await viewItems(0, [4, 5, RADIOS]);
      expect(onAgreeChange).toHaveBeenCalledTimes(1);
    });

    it('스크롤하는 동안 손으로 끌면 고르지 않는다', async () => {
      const { onAgreeChange } = await renderSignUp();
      await viewItems(0, [0, 1]);
      await userEvent.press(jumpButton()!);

      await fireEvent(list(), 'scrollBeginDrag');
      await viewItems(0, [5, RADIOS]);

      expect(onAgreeChange).not.toHaveBeenCalled();
    });

    // 스크린리더 요소 이동처럼 끌지 않고 움직이는 스크롤도 있어, 사용자가 고른 것을 나중에 덮어쓰지 않게 한다
    it('누른 뒤 라디오를 직접 고르면 그 선택을 지키고 저절로 동의하지 않는다', async () => {
      const { onAgreeChange } = await renderSignUp();
      await viewItems(0, [0, 1]);
      await userEvent.press(jumpButton()!);

      await userEvent.press(
        screen.getByRole('radio', {
          name: '서비스 이용약관, 동의하지 않습니다',
        }),
      );
      await viewItems(0, [5, RADIOS]);

      expect(onAgreeChange).toHaveBeenCalledTimes(1);
      expect(onAgreeChange).toHaveBeenCalledWith('service', false);
    });

    it('누른 뒤 그 약관 전문이 도착해 라디오가 밀려나면 새 자리로 다시 스크롤한다', async () => {
      const { queryClient } = await renderSignUp({
        fakeServer: withTermsDocuments(createFakeServer(), { service: hang() }),
        waitForText: false,
      });
      // 받는 중: [받는 중, 라디오]
      await viewItems(0, [0]);
      await userEvent.press(jumpButton()!);
      expect(lastScroll()).toEqual(
        expect.objectContaining({ index: flatIndex(0, 1), item: RADIOS_ITEM }),
      );

      await act(() =>
        queryClient.setQueryData(
          termsDocumentQueryKey('service'),
          toTermsBlocks(ARTICLES_TEXT),
        ),
      );

      // 전문 6덩어리 + 라디오. 라디오는 7번째 칸으로 밀려났다
      await waitFor(() =>
        expect(lastScroll()).toEqual(
          expect.objectContaining({
            index: flatIndex(0, RADIOS),
            item: RADIOS_ITEM,
            viewPosition: 1,
          }),
        ),
      );
      expect(scrollToIndex).toHaveBeenCalledTimes(2);
    });

    it('여러 약관이면 화면 맨 위에서 읽는 약관의 라디오로 가서 그 약관에 동의한다', async () => {
      const { onAgreeChange } = await renderSignUp({
        sections: [service, marketing],
        agreement: { service: true, MARKETING: false },
      });
      // 마케팅 동의서 [마케팅 동의, 본문입니다.] + 라디오가 도착할 때까지 (테스트의 목록은 앞 10칸만 그려 글로는 못 찾는다)
      await waitFor(() => expect(list().props.data[1].data).toHaveLength(3));

      // 동의한 서비스 이용약관을 읽는 동안은 없다
      await viewItems(0, [0, 1]);
      expect(
        screen.queryByRole('button', { name: /동의하기/ }),
      ).not.toBeOnTheScreen();

      await viewItems(1, [0, 1]);
      await userEvent.press(
        jumpButton('(선택) 혜택 이벤트 알림 수신동의, 약관 동의하기')!,
      );
      expect(lastScroll()).toEqual(
        expect.objectContaining({ index: flatIndex(1, 2), item: RADIOS_ITEM }),
      );

      await viewItems(1, [1, 2]);
      expect(onAgreeChange).toHaveBeenCalledWith('MARKETING', true);
      expect(onAgreeChange).toHaveBeenCalledTimes(1);
    });

    // 목록은 화면 가까이만 그린다(가상화). 먼 라디오는 아직 재지 않아 바로 갈 수 없다
    it('아직 그리지 않은 먼 라디오면 그려 둔 끝까지 먼저 가고 다시 찾아간다', async () => {
      jest.useFakeTimers();
      await renderSignUp();
      await viewItems(0, [0, 1]);
      await userEvent
        .setup({ advanceTimers: jest.advanceTimersByTime })
        .press(jumpButton()!);

      await failScroll(3);
      expect(lastScroll()).toEqual(
        expect.objectContaining({ index: 3, viewPosition: 0, animated: true }),
      );

      scrollToIndex.mockClear();
      await act(() => jest.advanceTimersByTime(100));
      expect(lastScroll()).toEqual(
        expect.objectContaining({
          index: flatIndex(0, RADIOS),
          item: RADIOS_ITEM,
        }),
      );
    });

    it('그려 둔 끝이 늘어나는 동안은 몇 번이고 계속 찾아간다', async () => {
      jest.useFakeTimers();
      await renderSignUp();
      await viewItems(0, [0, 1]);
      await userEvent
        .setup({ advanceTimers: jest.advanceTimersByTime })
        .press(jumpButton()!);

      for (let highest = 1; highest <= 30; highest += 1) {
        await failScroll(highest);
        await act(() => jest.advanceTimersByTime(100));
      }

      expect(lastScroll()).toEqual(
        expect.objectContaining({ item: RADIOS_ITEM }),
      );
    });

    it('그려 둔 끝이 더 늘지 않으면 멈추고, 나중에 라디오가 보여도 저절로 동의하지 않는다', async () => {
      jest.useFakeTimers();
      const { onAgreeChange } = await renderSignUp();
      await viewItems(0, [0, 1]);
      await userEvent
        .setup({ advanceTimers: jest.advanceTimersByTime })
        .press(jumpButton()!);

      for (let attempt = 0; attempt < 30; attempt += 1) {
        await failScroll(3);
        await act(() => jest.advanceTimersByTime(100));
      }
      scrollToIndex.mockClear();
      await failScroll(3);
      await act(() => jest.advanceTimersByTime(100));
      expect(scrollToIndex).not.toHaveBeenCalled();

      await viewItems(0, [5, RADIOS]);
      expect(onAgreeChange).not.toHaveBeenCalled();
    });

    it('화면을 떠나면 다시 찾아가기를 멈춘다', async () => {
      jest.useFakeTimers();
      await renderSignUp();
      await viewItems(0, [0, 1]);
      await userEvent
        .setup({ advanceTimers: jest.advanceTimersByTime })
        .press(jumpButton()!);
      await failScroll(3);
      scrollToIndex.mockClear();

      await screen.unmount();
      jest.advanceTimersByTime(1000);

      expect(scrollToIndex).not.toHaveBeenCalled();
    });
  });
});

/** 상세의 스크롤 목록(SectionList 가 그린 ScrollView). jest 목은 VirtualizedList 의 props 를 그대로 넘긴다 */
function list() {
  const [scroll] = screen.container.queryAll(
    node => node.type === 'RCTScrollView',
  );
  return scroll;
}

/**
 * 약관(sectionIndex) 안 칸 순서(0 부터, 머리 제외)를 목록이 펼친 순서로 바꾼다.
 * SectionList 는 약관마다 [머리, 칸…, 꼬리] 로 펼친다
 */
function flatIndex(sectionIndex: number, item: number) {
  const sections: readonly { data: readonly unknown[] }[] = list().props.data;
  const offset = sections
    .slice(0, sectionIndex)
    .reduce((sum, section) => sum + section.data.length + 2, 0);
  return offset + 1 + item;
}

/** 화면에 다 보이는 칸이 바뀐다. 칸은 약관(sectionIndex) 안의 순서다 (0 부터, 머리 제외) */
async function viewItems(sectionIndex: number, items: readonly number[]) {
  const props = list().props;
  const tokens = items.map(item => {
    const index = flatIndex(sectionIndex, item);
    return {
      index,
      key: String(index),
      item: props.getItem(props.data, index),
      isViewable: true,
    };
  });
  await act(() =>
    props.onViewableItemsChanged({ viewableItems: tokens, changed: tokens }),
  );
}
