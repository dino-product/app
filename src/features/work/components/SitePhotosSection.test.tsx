import { render, screen, within } from '@testing-library/react-native';
import { colors } from '../../../shared/design-system';
import { SitePhotosSection } from './SitePhotosSection';

const ADDRESS = '서울 강남구 역삼동 123-4 101호';

const renderSection = (photos: readonly string[]) =>
  render(<SitePhotosSection address={ADDRESS} photos={photos} />);

// #142: 작업 요청 사진(백엔드 sitePhotos)을 모든 작업 상세에서 같은 모양으로 보여준다. Figma 2714:12566
describe('SitePhotosSection', () => {
  it('제목 "현장 사진" 은 카드 바깥에, 카드 안에는 주소와 사진 칸이 있다', async () => {
    await renderSection(['https://cdn.example.com/a.jpg', 'mock://b']);

    const title = screen.getByRole('header', { name: '현장 사진' });
    const card = screen.getByTestId('site-photo-card');
    expect(title).toBeOnTheScreen();
    expect(within(card).queryByText('현장 사진')).not.toBeOnTheScreen();
    expect(within(card).getByText('주소')).toBeOnTheScreen();
    expect(within(card).getByText(ADDRESS)).toBeOnTheScreen();
    expect(within(card).getAllByTestId('photo-thumb')).toHaveLength(2);
  });

  it('카드는 흰 배경에 Gray100 테두리, 사진 칸은 110×110 모서리 10 이다', async () => {
    await renderSection(['mock://a']);

    expect(screen.getByTestId('site-photo-card')).toHaveStyle({
      backgroundColor: colors.white[100],
      borderColor: colors.gray[100],
      borderWidth: 1,
      borderRadius: 16,
      padding: 20,
      gap: 16,
    });
    expect(screen.getByTestId('photo-thumb')).toHaveStyle({
      width: 110,
      height: 110,
      borderRadius: 10,
    });
  });

  it('스크린리더는 사진 묶음을 "현장 사진 n장" 으로 읽는다', async () => {
    await renderSection(['mock://a', 'mock://b', 'mock://c']);

    expect(screen.getByLabelText('현장 사진 3장')).toBeOnTheScreen();
  });

  // 서버 사진 주소가 아직 가짜(fake-photo://, #112 G4)일 수 있다
  it('가짜 사진 주소는 이미지 대신 회색 자리로, 실제 주소는 이미지로 그린다', async () => {
    await renderSection([
      'fake-photo://abc123',
      'https://cdn.example.com/a.jpg',
    ]);

    const [fake, real] = screen.getAllByTestId('photo-thumb');
    expect(fake).not.toHaveProp('source');
    expect(fake).toHaveStyle({ backgroundColor: colors.gray[200] });
    expect(real).toHaveProp('source', { uri: 'https://cdn.example.com/a.jpg' });
  });

  it('보기 전용이다 (추가·삭제 버튼과 "n/6" 이 없다)', async () => {
    await renderSection(['mock://a']);

    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    expect(screen.queryByText(/\/6/)).not.toBeOnTheScreen();
  });

  // Figma 에 빈 상태가 없어 최소 구성이다 (Figma 미확인)
  it('사진이 없어도 섹션은 남고, 카드 안에 "등록된 현장 사진이 없습니다" 를 보인다', async () => {
    await renderSection([]);

    const card = screen.getByTestId('site-photo-card');
    expect(screen.getByRole('header', { name: '현장 사진' })).toBeOnTheScreen();
    expect(within(card).getByText(ADDRESS)).toBeOnTheScreen();
    expect(
      within(card).getByText('등록된 현장 사진이 없습니다'),
    ).toBeOnTheScreen();
    expect(screen.queryAllByTestId('photo-thumb')).toHaveLength(0);
    expect(screen.queryByLabelText(/^현장 사진 \d+장$/)).not.toBeOnTheScreen();
  });

  it('사진이 있으면 빈 상태 문구는 없다', async () => {
    await renderSection(['mock://a']);

    expect(
      screen.queryByText('등록된 현장 사진이 없습니다'),
    ).not.toBeOnTheScreen();
  });
});
