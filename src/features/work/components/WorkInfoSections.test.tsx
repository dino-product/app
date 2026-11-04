import { render, screen } from '@testing-library/react-native';
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
  it('작업 내용 카드는 작업 요청 이미지 카드처럼 회색 채움이고 테두리가 없다', async () => {
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

  // 서버 사진 주소가 아직 가짜(fake-photo://, #112 G4)라 이미지로 열 수 없다
  it('가짜 사진 주소는 이미지 대신 회색 자리로 그린다', async () => {
    await renderSections({
      ...workDetail,
      requestImages: ['fake-photo://abc123', 'https://cdn.example.com/a.jpg'],
    });

    expect(screen.getByText('2장')).toBeOnTheScreen();
    // 그린 Image 는 실제 주소 하나뿐이다
    const images = JSON.stringify(screen.toJSON()).split('"type":"Image"');
    expect(images).toHaveLength(2);
  });

  // #104: 작업 수행 상세의 사진 섹션은 그대로다 (Figma 3235-16226)
  it('기본은 작업 내용 카드 아래 "작업 요청 이미지 n장" 줄에 88 칸으로 보여준다', async () => {
    await renderSections();

    expect(screen.getByText('작업 요청 이미지')).toBeOnTheScreen();
    expect(screen.getByText('2장')).toBeOnTheScreen();
    expect(screen.getAllByTestId('photo-thumb')[0]).toHaveStyle({
      width: 88,
      height: 88,
      borderRadius: 8,
    });
    expect(screen.queryByText('현장 사진')).not.toBeOnTheScreen();
  });
});
