import { render, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import { StyleSheet, type TextInstance } from 'react-native';
import { colors } from '../tokens/colors';
import { typography } from '../tokens/typography';
import { Text } from './Text';

describe('Text', () => {
  it('기본은 Body/XS/Medium, Gray900 이다', async () => {
    await render(<Text>안녕하세요</Text>);

    expect(screen.getByText('안녕하세요')).toHaveStyle({
      ...typography['Body/XS/Medium'],
      color: colors.gray[900],
    });
  });

  it('ref 를 RN Text 로 넘긴다 (스크린리더 포커스를 옮길 때 쓴다)', async () => {
    const ref = createRef<TextInstance>();
    await render(<Text ref={ref}>제목</Text>);

    expect(ref.current).not.toBeNull();
  });

  it('variant 에 맞는 텍스트 스타일을 적용한다', async () => {
    await render(<Text variant="Title/S">제목</Text>);

    expect(screen.getByText('제목')).toHaveStyle(typography['Title/S']);
  });

  it('color 와 style 로 덮어쓸 수 있다', async () => {
    await render(
      <Text color={colors.secondary} style={styles.center}>
        강조
      </Text>,
    );

    expect(screen.getByText('강조')).toHaveStyle({
      color: colors.secondary,
      textAlign: 'center',
    });
  });

  it('Text 의 나머지 props 를 그대로 넘긴다', async () => {
    await render(
      <Text accessibilityRole="header" numberOfLines={1}>
        헤더
      </Text>,
    );

    expect(screen.getByRole('header', { name: '헤더' })).toHaveProp(
      'numberOfLines',
      1,
    );
  });
});

const styles = StyleSheet.create({ center: { textAlign: 'center' } });
