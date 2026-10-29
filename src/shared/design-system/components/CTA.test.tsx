import { render, screen, userEvent } from '@testing-library/react-native';
import { View } from 'react-native';
import { colors } from '../tokens/colors';
import { typography } from '../tokens/typography';
import { CTA } from './CTA';

describe('CTA', () => {
  it('라벨을 이름으로 가진 버튼을 그린다', async () => {
    await render(<CTA label="작업 시작" onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: '작업 시작' })).toBeOnTheScreen();
  });

  it('누르면 onPress 를 호출한다', async () => {
    const onPress = jest.fn();
    await render(<CTA label="작업 시작" onPress={onPress} />);

    await userEvent.press(screen.getByRole('button', { name: '작업 시작' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled 면 누를 수 없다', async () => {
    const onPress = jest.fn();
    await render(<CTA label="작업 시작" onPress={onPress} disabled />);

    const button = screen.getByRole('button', { name: '작업 시작' });
    await userEvent.press(button);

    expect(button).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });

  describe('Bottom CTA', () => {
    it('기본은 primary · L(56) 이다', async () => {
      await render(<CTA label="확인" onPress={jest.fn()} />);

      expect(screen.getByRole('button')).toHaveStyle({
        backgroundColor: colors.primary,
        height: 56,
        borderRadius: 12,
      });
      expect(screen.getByText('확인')).toHaveStyle({
        ...typography['Body/XS/Medium'],
        color: colors.white[100],
      });
    });

    it('size M 은 높이 46 이다', async () => {
      await render(<CTA label="확인" size="M" onPress={jest.fn()} />);

      expect(screen.getByRole('button')).toHaveStyle({ height: 46 });
    });
  });

  describe('Modal CTA', () => {
    it('높이 42, 모서리 8, Button/S 텍스트다', async () => {
      await render(<CTA type="modal" label="확인" onPress={jest.fn()} />);

      expect(screen.getByRole('button')).toHaveStyle({
        height: 42,
        borderRadius: 8,
      });
      expect(screen.getByText('확인')).toHaveStyle(typography['Button/S']);
    });
  });

  describe('variant', () => {
    it('secondary 는 Accepted/1 배경이다', async () => {
      await render(
        <CTA variant="secondary" label="수락" onPress={jest.fn()} />,
      );

      expect(screen.getByRole('button')).toHaveStyle({
        backgroundColor: colors.accepted[1],
      });
    });

    it('outline 은 Gray500 테두리와 Gray700 텍스트다', async () => {
      await render(<CTA variant="outline" label="취소" onPress={jest.fn()} />);

      expect(screen.getByRole('button')).toHaveStyle({
        borderWidth: 1,
        borderColor: colors.gray[500],
      });
      expect(screen.getByText('취소')).toHaveStyle({ color: colors.gray[700] });
    });

    it('reject 는 Warning/2 배경과 Warning/1 텍스트다', async () => {
      await render(<CTA variant="reject" label="거절" onPress={jest.fn()} />);

      expect(screen.getByRole('button')).toHaveStyle({
        backgroundColor: colors.warning[2],
      });
      expect(screen.getByText('거절')).toHaveStyle({
        color: colors.warning[1],
      });
    });
  });

  it('icon 을 라벨 앞에 그린다', async () => {
    await render(
      <CTA
        label="추가"
        icon={<View testID="cta-icon" />}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByTestId('cta-icon')).toBeOnTheScreen();
  });
});
