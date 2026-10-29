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
        minHeight: 56,
        borderRadius: 12,
      });
      expect(screen.getByText('확인')).toHaveStyle({
        ...typography['Body/XS/Medium'],
        color: colors.white[100],
      });
    });

    it('size M 은 높이 46 이다', async () => {
      await render(<CTA label="확인" size="M" onPress={jest.fn()} />);

      expect(screen.getByRole('button')).toHaveStyle({ minHeight: 46 });
    });

    // 글꼴을 키운 사용자에게 라벨이 잘리지 않도록 높이는 최소값으로만 건다
    it('고정 height 를 쓰지 않는다', async () => {
      await render(<CTA label="확인" onPress={jest.fn()} />);

      expect(screen.getByRole('button')).not.toHaveStyle({ height: 56 });
    });
  });

  describe('Modal CTA', () => {
    it('높이 42, 모서리 8, Button/S 텍스트다', async () => {
      await render(<CTA type="modal" label="확인" onPress={jest.fn()} />);

      expect(screen.getByRole('button')).toHaveStyle({
        minHeight: 42,
        borderRadius: 8,
      });
      expect(screen.getByText('확인')).toHaveStyle(typography['Button/S']);
    });

    it('42pt 높이를 터치 최소 44pt 로 보완한다', async () => {
      await render(<CTA type="modal" label="확인" onPress={jest.fn()} />);

      expect(screen.getByRole('button')).toHaveProp('hitSlop', {
        top: 1,
        bottom: 1,
      });
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

  it('brand 는 Secondary 배경이다 (화면 CTA: 작업 시작, 완료 보고 작성하기)', async () => {
    await render(<CTA variant="brand" label="작업 시작" onPress={jest.fn()} />);

    expect(screen.getByRole('button')).toHaveStyle({
      backgroundColor: colors.secondary,
    });
    expect(screen.getByText('작업 시작')).toHaveStyle({
      color: colors.white[100],
    });
  });

  it('disabled 면 variant 와 관계없이 회색으로 그린다', async () => {
    await render(
      <CTA
        variant="primary"
        label="완료보고 제출"
        onPress={jest.fn()}
        disabled
      />,
    );

    expect(screen.getByRole('button')).toHaveStyle({
      backgroundColor: colors.gray[400],
    });
    expect(screen.getByText('완료보고 제출')).toHaveStyle({
      color: colors.white[100],
    });
  });
});
