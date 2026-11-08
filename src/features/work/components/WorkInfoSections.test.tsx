import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors } from '../../../shared/design-system';
import { workDetail } from '../mockData';
import type { WorkDetail } from '../model';
import { WorkInfoSections } from './WorkInfoSections';

const renderSections = (work: WorkDetail = workDetail) =>
  render(
    <WorkInfoSections work={work} onCall={jest.fn()} onNavigate={jest.fn()} />,
  );

describe('WorkInfoSections', () => {
  it('작업 내용 카드는 회색 채움이고 테두리가 없다', async () => {
    await renderSections();

    const card = screen.getByTestId('work-content-card');
    expect(card).toHaveStyle({ backgroundColor: colors.gray[50] });
    expect(StyleSheet.flatten(card.props.style).borderWidth ?? 0).toBe(0);
  });

  it('가격을 천 단위 쉼표와 "원" 으로 보여준다', async () => {
    await renderSections();

    expect(screen.getByText('75,000원')).toBeOnTheScreen();
  });

  it('가격이 정해지지 않았으면 "- 원" 을 보여준다', async () => {
    await renderSections({ ...workDetail, price: null });

    expect(screen.getByText('- 원')).toBeOnTheScreen();
  });

  it('칩 이름이 따로 있으면 그 이름을 보여준다 (취소 작업)', async () => {
    await renderSections({
      ...workDetail,
      status: 'rejected',
      statusLabel: '취소',
    });

    expect(screen.getByText('취소')).toBeOnTheScreen();
    expect(screen.queryByText('거절')).not.toBeOnTheScreen();
  });

  // #142: 작업 요청 사진(sitePhotos)은 모든 작업 상세가 같은 현장 사진 섹션으로 보여준다 (Figma 2714:12566)
  it('작업 내용 다음에 "현장 사진" 섹션이 있고 요청 사진을 110 칸으로 보여준다', async () => {
    await renderSections();

    // 섹션 제목이 그려진 순서에서 작업 내용 바로 다음이 현장 사진이다
    const headers = screen.getAllByRole('header');
    const content = screen.getByRole('header', { name: '작업 내용' });
    const site = screen.getByRole('header', { name: '현장 사진' });
    expect(headers.indexOf(content)).toBeGreaterThanOrEqual(0);
    expect(headers.indexOf(site)).toBe(headers.indexOf(content) + 1);

    const card = screen.getByTestId('site-photo-card');
    expect(within(card).getByText(workDetail.address)).toBeOnTheScreen();
    const thumbs = within(card).getAllByTestId('photo-thumb');
    expect(thumbs).toHaveLength(workDetail.requestImages.length);
    expect(thumbs[0]).toHaveStyle({ width: 110, height: 110 });
  });

  it('작업 내용 카드 아래 "작업 요청 이미지 n장" 줄은 따로 그리지 않는다 (같은 사진을 두 번 보이지 않는다)', async () => {
    await renderSections();

    expect(screen.queryByText('작업 요청 이미지')).not.toBeOnTheScreen();
    expect(screen.getAllByTestId('photo-thumb')).toHaveLength(
      workDetail.requestImages.length,
    );
  });

  it('요청 사진이 없어도 현장 사진 섹션은 빈 상태로 남는다', async () => {
    await renderSections({ ...workDetail, requestImages: [] });

    expect(screen.getByRole('header', { name: '현장 사진' })).toBeOnTheScreen();
    expect(screen.getByText('등록된 현장 사진이 없습니다')).toBeOnTheScreen();
  });
});
