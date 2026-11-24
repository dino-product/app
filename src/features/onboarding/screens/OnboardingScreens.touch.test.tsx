import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import {
  expectMinTouchTarget,
  hitSlopOf,
} from '../../../shared/testing/touchTarget';
import { noTermsAgreed } from '../model';
import { LoginScreen } from './LoginScreen';
import { TermsAgreementScreen } from './TermsAgreementScreen';

// 새 버튼·체크박스의 터치 영역 (iOS 44pt, Android 48dp). 보이는 크기는 Figma 그대로 두고 hitSlop 으로 넓힌다
describe('온보딩 터치 영역', () => {
  it('로그인 시작 버튼은 높이 56 이라 그대로 충분하다', async () => {
    await render(
      <LoginScreen
        methods={['KAKAO', 'APPLE']}
        recentMethod={null}
        onLogin={jest.fn()}
      />,
    );

    for (const name of ['카카오로 시작하기', 'Apple로 시작하기']) {
      expectMinTouchTarget(screen.getByRole('button', { name }), {
        height: 56,
      });
    }
  });

  describe('약관 동의', () => {
    const renderTerms = () =>
      render(
        <TermsAgreementScreen
          agreement={noTermsAgreed}
          onAgreeAll={jest.fn()}
          onOpenTerms={jest.fn()}
          onBack={jest.fn()}
          onSignUp={jest.fn()}
        />,
      );

    // 상자(22)·체크 표시(24)가 글자 줄보다 높아 보이는 높이가 된다
    it('전체 동의 체크박스는 상자 22 를 위아래로 넓힌다', async () => {
      await renderTerms();

      expectMinTouchTarget(
        screen.getByRole('checkbox', { name: '모든 약관에 동의합니다.' }),
        { height: 22 },
      );
    });

    // 행 전체가 약관 상세를 여는 버튼이다 (#193). 높이는 체크 표시·> 아이콘(24)이 정한다
    it('약관 행은 체크 표시 24 높이를 위아래로 넓힌다', async () => {
      await renderTerms();

      const rows = screen.getAllByRole('button', { name: /\((필수|선택)\)$/ });
      expect(rows).toHaveLength(4);
      for (const row of rows) {
        expectMinTouchTarget(row, { height: 24 });
      }
    });

    // 넓힌 터치 영역이 이웃 행까지 넘어가면 경계를 누를 때 엉뚱한 약관이 열린다 (Android 48 은 행 간격도 넓혀 맞춘다)
    it('약관 행의 넓힌 터치 영역은 이웃 행과 겹치지 않는다', async () => {
      await renderTerms();

      const gap = StyleSheet.flatten(
        screen.getByTestId('terms-rows').props.style,
      ).gap;
      for (const row of screen.getAllByRole('button', {
        name: /\((필수|선택)\)$/,
      })) {
        const slop = hitSlopOf(row);
        expect(slop.bottom + slop.top).toBeLessThanOrEqual(gap);
      }
    });
  });
});
