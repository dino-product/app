import { render, screen } from '@testing-library/react-native';
import { colors } from '../../../shared/design-system';
import { workDetail } from '../mockData';
import type { WorkDetail } from '../model';
import { WorkInfoSections } from './WorkInfoSections';

const renderSections = (work: WorkDetail = workDetail) =>
  render(
    <WorkInfoSections work={work} onCall={jest.fn()} onNavigate={jest.fn()} />,
  );

describe('WorkInfoSections', () => {
  it('작업 내용 카드는 작업 요청 이미지 카드처럼 회색 채움이고 테두리가 없다', async () => {
    await renderSections();

    const card = screen.getByTestId('work-content-card');
    expect(card).toHaveStyle({ backgroundColor: colors.gray[50] });
    expect(card).not.toHaveStyle({ borderWidth: 1 });
  });

  it('가격을 천 단위 쉼표와 "원" 으로 보여준다', async () => {
    await renderSections();

    expect(screen.getByText('75,000원')).toBeOnTheScreen();
  });

  it('가격이 정해지지 않았으면 "- 원" 을 보여준다', async () => {
    await renderSections({ ...workDetail, price: null });

    expect(screen.getByText('- 원')).toBeOnTheScreen();
  });
});
