import { screen, userEvent, within } from '@testing-library/react-native';
import {
  CURRENT_WORK_TITLE,
  findHomeLoaded,
  fixAppTestClock,
  openStartedWorkDetail,
  renderSignedInHome,
} from './testing';

// #142 작업 요청 사진(현장 사진)은 어느 탭에서 연 작업 상세든 같은 섹션으로 보인다.
// 로컬 저장소 처음 데이터의 작업은 요청 사진(sitePhotos)이 2장씩이다 (localSeedTesting)
const SEED_SITE_PHOTOS = 2;

const header = (name: string) => screen.queryByRole('header', { name });
const tab = (name: string) => screen.getByRole('tab', { name });

async function expectSitePhotos() {
  expect(
    await screen.findByRole('header', { name: '현장 사진' }),
  ).toBeOnTheScreen();
  expect(
    within(screen.getByTestId('site-photo-card')).getAllByTestId('photo-thumb'),
  ).toHaveLength(SEED_SITE_PHOTOS);
}

fixAppTestClock();

describe('App — 작업 상세의 현장 사진 (#142)', () => {
  it('홈(작업 수행)에서 연 작업전 상세에 현장 사진 섹션이 있다', async () => {
    await renderSignedInHome();

    await userEvent.press(await findHomeLoaded());

    expect(header('작업 상세')).toBeOnTheScreen();
    expect(screen.getByText(CURRENT_WORK_TITLE)).toBeOnTheScreen();
    await expectSitePhotos();
  });

  it('홈(작업 수행)에서 연 작업중 상세에도 현장 사진 섹션이 있다', async () => {
    await renderSignedInHome();

    await openStartedWorkDetail();

    await expectSitePhotos();
  });

  it('내 일정 › 응답 필요에서 연 요청 상세에 현장 사진 섹션이 있다', async () => {
    await renderSignedInHome();
    await userEvent.press(tab('내 일정'));
    await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));

    await userEvent.press(screen.getAllByRole('button', { name: / 상세,/ })[0]);

    expect(
      await screen.findByRole('button', { name: '수락' }),
    ).toBeOnTheScreen();
    await expectSitePhotos();
  });

  it('작업 이력에서 연 완료 작업 상세에 현장 사진 섹션이 있다', async () => {
    await renderSignedInHome();
    await userEvent.press(tab('작업 이력'));

    await userEvent.press(
      screen.getAllByRole('button', { name: /, 완료, / })[0],
    );

    expect(
      await screen.findByRole('button', { name: '제출 완료' }),
    ).toBeOnTheScreen();
    expect(header('작업 상세')).toBeOnTheScreen();
    await expectSitePhotos();
  });
});
