import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { noTermsAgreed } from '../../onboarding/model';
import { TermsAgreementScreen } from '../../onboarding/screens/TermsAgreementScreen';
import {
  createFakeServer,
  rawResponse,
} from '../../../shared/testing/fakeServer';
import { renderWithApi } from '../../../shared/testing/renderWithApi';
import { expectOnlySkeletons } from '../../../shared/testing/skeleton';
import { termsDocumentUrl } from '../documents';
import { termsText, withTermsDocuments } from '../testing';
import { TERMS_LOAD_FAILED } from '../termsQueries';
import {
  TermsDetailScreen,
  type TermsDetailSection,
} from './TermsDetailScreen';

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
        radios.getByRole('radio', { name: '동의합니다' }),
      ).not.toBeChecked();
      expect(
        radios.getByRole('radio', { name: '동의하지 않습니다' }),
      ).toBeChecked();
      await screen.findByText('제1조(service 목적)');
    });

    it('동의한 약관은 동의합니다가 골라져 있다', async () => {
      await renderAgreement({ service: true });

      expect(
        radiosOf('service').getByRole('radio', { name: '동의합니다' }),
      ).toBeChecked();
      await screen.findByText('제1조(service 목적)');
    });

    it('라디오를 고르면 그 약관의 동의 상태를 알린다', async () => {
      const onAgreeChange = await renderAgreement({ service: false });
      const radios = radiosOf('service');

      await userEvent.press(radios.getByRole('radio', { name: '동의합니다' }));
      expect(onAgreeChange).toHaveBeenLastCalledWith('service', true);

      await userEvent.press(
        radios.getByRole('radio', { name: '동의하지 않습니다' }),
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
          name: '동의하지 않습니다',
        }),
      );
      expect(onAgreeChange).toHaveBeenLastCalledWith('MARKETING', false);
    });
  });
});
