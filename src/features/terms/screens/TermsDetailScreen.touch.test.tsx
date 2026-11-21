import { screen } from '@testing-library/react-native';
import { createFakeServer } from '../../../shared/testing/fakeServer';
import { renderWithApi } from '../../../shared/testing/renderWithApi';
import { expectMinTouchTarget } from '../../../shared/testing/touchTarget';
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
});
