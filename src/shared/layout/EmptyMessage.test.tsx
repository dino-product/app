import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors, typography } from '../design-system';
import { EmptyMessage } from './EmptyMessage';

// #196: 빈 상태 안내는 아이콘·설명·굵은 글 없이 Gray600 가운데 글 한 줄이다
describe('EmptyMessage', () => {
  it('기본은 Body/XS/Regular Gray600 가운데 글이다', async () => {
    await render(<EmptyMessage>이 날은 일정이 없습니다</EmptyMessage>);

    expect(screen.getByText('이 날은 일정이 없습니다')).toHaveStyle({
      ...typography['Body/XS/Regular'],
      color: colors.gray[600],
      textAlign: 'center',
    });
  });

  it('자리마다 Regular·Medium 글자 스타일과 위 간격을 받는다', async () => {
    await render(
      <EmptyMessage variant="Caption/M/Medium" style={styles.top}>
        예정된 일정이 없습니다
      </EmptyMessage>,
    );

    expect(screen.getByText('예정된 일정이 없습니다')).toHaveStyle({
      ...typography['Caption/M/Medium'],
      color: colors.gray[600],
      paddingTop: 58,
    });
  });

  it('굵은 글(SemiBold·Bold)은 타입에서 막는다', () => {
    const bold = [
      // @ts-expect-error 빈 상태 안내에는 굵은 글을 쓰지 않는다
      <EmptyMessage key="semi" variant="Body/XS/SemiBold">
        글
      </EmptyMessage>,
      // @ts-expect-error 빈 상태 안내에는 굵은 글을 쓰지 않는다
      <EmptyMessage key="bold" variant="Body/S/Bold">
        글
      </EmptyMessage>,
    ];
    expect(bold).toHaveLength(2);
  });
});

const styles = StyleSheet.create({ top: { paddingTop: 58 } });
