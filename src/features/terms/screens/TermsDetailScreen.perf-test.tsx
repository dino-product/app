import { act, screen } from '@testing-library/react-native';
import { NativeModules } from 'react-native';
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

  // #218 '약관 동의하기' 앵커. 읽는 약관·라디오가 보이는지가 바뀔 때만 화면을 다시 그리고, 목록(전문 칸)은 그대로다
  it('약관 동의하기 앵커는 읽는 자리가 바뀔 때만 다시 그리고 중복 렌더가 없다', async () => {
    // 등장·퇴장 애니메이션(UI 스레드)이 끝나 버튼을 내리는 렌더는 빼고 화면이 다시 그리는 것만 잰다
    const startAnimation = jest
      .spyOn(NativeModules.NativeAnimatedModule, 'startAnimatingNode')
      .mockImplementation(() => {});
    const api = createTestApi({
      server: withTermsDocuments(createFakeServer()),
    });
    api.queryClient.setQueryData(
      termsDocumentQueryKey('service'),
      toTermsBlocks(sampleTermsText('service')),
    );
    // 목록이 화면에 다 보이는 칸을 알린다 (sectionIndex 0, 머리 다음 칸부터 1)
    const view = async (indices: readonly number[]) => {
      const [scroll] = screen.container.queryAll(
        node => node.type === 'RCTScrollView',
      );
      const tokens = indices.map(index => ({
        index,
        key: String(index),
        item: scroll.props.getItem(scroll.props.data, index),
        isViewable: true,
      }));
      await act(() =>
        scroll.props.onViewableItemsChanged({
          viewableItems: tokens,
          changed: tokens,
        }),
      );
    };

    const result = await measureRenders(
      <TermsDetailScreen
        sections={sections}
        agreement={{ service: false }}
        onAgreeChange={() => {}}
        onBack={() => {}}
      />,
      {
        wrapper: api.wrapper,
        scenario: async () => {
          await view([1, 2]); // 본문을 읽는다 → 버튼이 나타난다
          await view([1, 2]); // 같은 자리 → 그리지 않는다
          await view([2]); // 같은 약관·라디오는 화면 밖 → 그리지 않는다
          await view([2, 3]); // 라디오가 다 보인다 → 버튼이 숨는다
        },
      },
    );

    // 마운트 1 + 나타남 1 + 숨음 1
    expect(Math.max(...result.counts)).toBe(3);
    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
    startAnimation.mockRestore();
  }, 30_000);
});
