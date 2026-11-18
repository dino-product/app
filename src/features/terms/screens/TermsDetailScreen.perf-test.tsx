import { measureRenders } from 'reassure';
import { perfBudget } from '../../../shared/perf/budget';
import { createFakeServer } from '../../../shared/testing/fakeServer';
import { createTestApi } from '../../../shared/testing/renderWithApi';
import { termsDocumentQueryKey } from '../termsQueries';
import { toTermsBlocks } from '../termsText';
import { sampleTermsText, withTermsDocuments } from '../testing';
import {
  TermsDetailScreen,
  type TermsDetailSection,
} from './TermsDetailScreen';

const sections: readonly TermsDetailSection[] = [
  { key: 'service', title: '서비스 이용약관', document: 'service' },
];

describe('TermsDetailScreen 렌더 예산', () => {
  it('마운트 시 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    // 캐시에 넣어 둔 전문으로 그린다 (전문은 받은 뒤 다시 받지 않는다: staleTime Infinity)
    const api = createTestApi({
      server: withTermsDocuments(createFakeServer()),
    });
    api.queryClient.setQueryData(
      termsDocumentQueryKey('service'),
      toTermsBlocks(sampleTermsText('service')),
    );

    const result = await measureRenders(
      <TermsDetailScreen sections={sections} onBack={() => {}} />,
      { wrapper: api.wrapper },
    );

    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);
});
