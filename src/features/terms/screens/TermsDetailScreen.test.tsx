import { screen, userEvent, waitFor } from '@testing-library/react-native';
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
    expect(screen.getByText('Orbit 서비스 이용약관')).toBeOnTheScreen();
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

  it('뒤로 가기를 누르면 알린다', async () => {
    const { onBack } = await renderDetail();

    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(onBack).toHaveBeenCalledTimes(1);
    await screen.findByText('제1조(목적)');
  });
});
