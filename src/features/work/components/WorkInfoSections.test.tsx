import {
  act,
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors, typography } from '../../../shared/design-system';
import type { HostElement } from '../../../shared/testing/touchTarget';
import { workDetail } from '../mockData';
import type { WorkDetail } from '../model';
import { WorkInfoSections } from './WorkInfoSections';

const renderSections = (
  work: WorkDetail = workDetail,
  handlers: { onNavigate?: jest.Mock; onOpenMap?: jest.Mock } = {},
) =>
  render(
    <WorkInfoSections
      work={work}
      onCall={jest.fn()}
      onNavigate={handlers.onNavigate ?? jest.fn()}
      onOpenMap={handlers.onOpenMap ?? jest.fn()}
    />,
  );

const place = { address: workDetail.address, location: workDetail.location };

describe('WorkInfoSections', () => {
  it('작업 내용 카드는 회색 채움이고 테두리가 없다', async () => {
    await renderSections();

    const card = screen.getByTestId('work-content-card');
    expect(card).toHaveStyle({ backgroundColor: colors.background[3] });
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

  // #67: 작업 수행 상세(Figma 3235:16278)·응답 필요 상세(3463:16686)의 작업 위치 카드
  describe('작업 위치', () => {
    // '주소' 줄은 작업 위치 카드와 현장 사진 카드(#142)에 있다. 작업 위치가 먼저다
    const locationCard = () =>
      screen.getAllByText('주소')[0].parent!.parent as ReturnType<
        typeof screen.getByText
      >;

    it('카드 안 주소 아래에 서버 좌표의 카카오맵을 그린다', async () => {
      await renderSections();

      const map = within(locationCard()).getByTestId(
        'work-location-native-map',
        { includeHiddenElements: true },
      );
      expect(map.props).toMatchObject({
        latitude: workDetail.location!.latitude,
        longitude: workDetail.location!.longitude,
      });
    });

    // 키·플랫폼 인증 실패, 네트워크 오류: 지도만 회색 자리로 두고 주소 글자와 길찾기는 그대로 쓴다
    it('지도를 그리지 못해도 주소 글자와 길찾기는 그대로 쓸 수 있다', async () => {
      const onNavigate = jest.fn();
      await renderSections(workDetail, { onNavigate });

      await act(() =>
        screen
          .getByTestId('work-location-native-map', {
            includeHiddenElements: true,
          })
          .props.onMapError({ nativeEvent: { code: 401 } }),
      );

      expect(
        within(locationCard()).getByText(workDetail.address),
      ).toBeOnTheScreen();
      expect(
        within(locationCard()).getByTestId('work-location-map-placeholder', {
          includeHiddenElements: true,
        }),
      ).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('button', { name: '길찾기' }));
      expect(onNavigate).toHaveBeenCalledWith(place);
    });

    it('좌표가 없으면 지도 대신 회색 자리를 둔다', async () => {
      await renderSections({ ...workDetail, location: null });

      expect(
        within(locationCard()).getByTestId('work-location-map-placeholder', {
          includeHiddenElements: true,
        }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole('imagebutton')).toBeNull();
    });

    it('지도를 누르면 그 주소·좌표로 카카오맵 열기를 부른다', async () => {
      const onOpenMap = jest.fn();
      await renderSections(workDetail, { onOpenMap });

      await userEvent.press(
        screen.getByRole('imagebutton', { name: '작업 위치 지도' }),
      );

      expect(onOpenMap).toHaveBeenCalledWith(place);
    });

    it('길찾기를 누르면 주소와 좌표를 넘긴다 (좌표가 없으면 null)', async () => {
      const onNavigate = jest.fn();
      await renderSections({ ...workDetail, location: null }, { onNavigate });

      await userEvent.press(screen.getByRole('button', { name: '길찾기' }));

      expect(onNavigate).toHaveBeenCalledWith({ ...place, location: null });
    });

    // Figma Button 3235:16291: 채움 Primary, 높이 56, 모서리 12, 좌우 16·위아래 10, 간격 12, 아이콘 12
    it('길찾기 버튼은 Figma 대로 높이 56 이고 아이콘은 12 다', async () => {
      await renderSections();

      const button = screen.getByRole('button', { name: '길찾기' });
      expect(button).toHaveStyle({
        minHeight: 56,
        borderRadius: 12,
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: colors.primary,
      });
      expect(
        screen.getByTestId('navigate-icon', { includeHiddenElements: true }),
      ).toHaveStyle({ width: 12, height: 12 });
    });
  });
});

const fontOf = (variant: keyof typeof typography) => ({
  fontFamily: typography[variant].fontFamily,
  fontSize: typography[variant].fontSize,
});

// Figma 작업 상세 (내 일정 요청 상세 2714:12494, 작업 수행 3235:15926, 작업 이력 3101:5794·3463:16630 이 같다)
describe('WorkInfoSections Figma 값', () => {
  it('요약은 제목 줄(제목↔칩 12)과 코드 줄 사이 12, 등록일은 Caption/M/Medium Gray600 이다', async () => {
    await renderSections();

    const titleRow = screen.getByText(workDetail.title).parent as HostElement;
    expect(titleRow).toHaveStyle({ gap: 12 });
    expect(titleRow.parent).toHaveStyle({ gap: 12 });
    expect(screen.getByText(`· ${workDetail.registeredAt} 등록`)).toHaveStyle({
      ...fontOf('Caption/M/Medium'),
      color: colors.gray[600],
    });
  });

  it('일정 및 담당 카드의 두 줄 사이는 14, 고객 카드의 고객명과 연락처 줄 사이는 12 다', async () => {
    await renderSections();

    const dateField = screen.getByText('날짜').parent as HostElement;
    expect(dateField.parent?.parent).toHaveStyle({ gap: 14 });
    const nameField = screen.getByText('고객명').parent as HostElement;
    expect(nameField.parent).toHaveStyle({ gap: 12 });
  });

  it('고객 전화 버튼은 44 원에 Gray100 이다', async () => {
    await renderSections();

    expect(
      screen.getByRole('button', { name: '박민지 고객에게 전화' }),
    ).toHaveStyle({
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.gray[100],
    });
  });

  // 작업 내용 카드: Background/3, 모서리 14, 좌우 20·위아래 21, 메모 → 20 → 선 → 20 → 가격
  it('작업 내용 카드는 모서리 14, 좌우 20·위아래 21, 줄 사이 20 이다', async () => {
    await renderSections();

    expect(screen.getByTestId('work-content-card')).toHaveStyle({
      borderRadius: 14,
      paddingHorizontal: 20,
      paddingVertical: 21,
      gap: 20,
    });
  });

  it('작업 메모는 라벨 아래 8 에 Caption/M/Medium Gray800 본문, 가격은 Body/S/Bold Gray800 이다', async () => {
    await renderSections();

    const memo = screen.getByText(workDetail.memo);
    expect(memo).toHaveStyle({
      ...fontOf('Caption/M/Medium'),
      color: colors.gray[800],
    });
    expect(memo.parent).toHaveStyle({ gap: 8 });
    expect(screen.getByText('75,000원')).toHaveStyle({
      ...fontOf('Body/S/Bold'),
      color: colors.gray[800],
    });
  });
});
