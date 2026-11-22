import { act, screen } from '@testing-library/react-native';
import { createFakeServer } from '../../../shared/testing/fakeServer';
import { renderWithApi } from '../../../shared/testing/renderWithApi';
import {
  expectMinTouchTarget,
  stylePt,
} from '../../../shared/testing/touchTarget';
import { withTermsDocuments } from '../testing';
import { TermsDetailScreen } from './TermsDetailScreen';

// 가입 약관 상세의 동의 라디오 (#193). 원(24)은 Figma 크기 그대로 두고 위아래를 최소 터치 영역(iOS 44, Android 48)으로 넓힌다
describe('TermsDetailScreen 터치 영역', () => {
  it('동의합니다·동의하지 않습니다 라디오는 최소 터치 영역 이상이다', async () => {
    await renderWithApi(
      <TermsDetailScreen
        sections={[
          { key: 'SERVICE', title: '(필수) 서비스 이용약관', document: null },
        ]}
        agreement={{ SERVICE: false }}
        onAgreeChange={jest.fn()}
        onBack={jest.fn()}
      />,
      { server: withTermsDocuments(createFakeServer()) },
    );

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    for (const radio of radios) {
      expectMinTouchTarget(radio, { height: 24 });
    }
  });

  // #218 '약관 동의하기' 앵커 (작업 상세 '완료 보고 작성하기' 와 같은 CTA L, 높이 56)
  it('약관 동의하기 앵커는 최소 터치 영역 이상이다', async () => {
    await renderWithApi(
      <TermsDetailScreen
        sections={[
          { key: 'SERVICE', title: '서비스 이용약관', document: null },
        ]}
        agreement={{ SERVICE: false }}
        onAgreeChange={jest.fn()}
        onBack={jest.fn()}
      />,
      { server: withTermsDocuments(createFakeServer()) },
    );
    // 준비 중 안내를 읽는 중이고 라디오는 화면 밖이다
    const [scroll] = screen.container.queryAll(
      node => node.type === 'RCTScrollView',
    );
    const token = {
      index: 1,
      key: '1',
      item: scroll.props.getItem(scroll.props.data, 1),
      isViewable: true,
    };
    await act(() =>
      scroll.props.onViewableItemsChanged({
        viewableItems: [token],
        changed: [token],
      }),
    );

    const anchor = screen.getByRole('button', {
      name: '서비스 이용약관 동의하기',
    });
    expectMinTouchTarget(anchor, { height: stylePt(anchor, 'minHeight') });
  });
});
