import { screen, userEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { createLocalWorkRepository } from '../features/work/data/LocalWorkRepository';
import {
  LOCAL_ORGANIZATION_NAME,
  makeLocalSeed,
} from '../features/work/data/localSeedTesting';
import {
  APP_TEST_NOW,
  fixAppTestClock,
  openStartedWorkDetail,
  renderSignedInApp,
} from './testing';

// #67 작업 위치 지도: 작업 상세의 서버 좌표로 카카오맵을 그리고, 누르면 카카오맵(앱 → 없으면 웹)을 연다.
// 로컬 저장소는 좌표를 구하지 않으므로 상세에 서버 좌표(LocationResponse)를 얹은 저장소를 쓴다
fixAppTestClock();
// 앱 전체를 켜고 작업 상세까지 들어가므로 첫 케이스가 무겁다 (App.my·App.onboarding 과 같은 값)
jest.setTimeout(20_000);

const site = { latitude: 37.556151, longitude: 126.922803 };

function repositoryWithLocation(location: typeof site | null) {
  const repository = createLocalWorkRepository({
    seed: makeLocalSeed(new Date(APP_TEST_NOW)),
    organizationName: LOCAL_ORGANIZATION_NAME,
    now: () => new Date(),
  });
  const getWorkDetail = repository.getWorkDetail.bind(repository);
  jest
    .spyOn(repository, 'getWorkDetail')
    .mockImplementation(async (...args) => ({
      ...(await getWorkDetail(...args)),
      location,
    }));
  return repository;
}

describe('App — 작업 위치 지도 (#67)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('서버 좌표가 있으면 지도를 누를 때 카카오맵에서 그 위치를, 길찾기는 카카오맵 길찾기를 연다', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderSignedInApp({ workRepository: repositoryWithLocation(site) });
    await openStartedWorkDetail();

    await userEvent.press(
      screen.getByRole('imagebutton', { name: '작업 위치 지도' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '길찾기' }));

    expect(openURL).toHaveBeenNthCalledWith(
      1,
      'kakaomap://look?p=37.556151,126.922803',
    );
    expect(openURL).toHaveBeenNthCalledWith(
      2,
      'kakaomap://route?ep=37.556151,126.922803&by=car',
    );
  });

  it('카카오맵 앱이 없으면 웹 카카오맵을 연다', async () => {
    const openURL = jest
      .spyOn(Linking, 'openURL')
      .mockImplementation(async url => {
        if (url.startsWith('kakaomap://')) {
          throw new Error('no handler');
        }
      });
    await renderSignedInApp({ workRepository: repositoryWithLocation(site) });
    await openStartedWorkDetail();

    await userEvent.press(
      screen.getByRole('imagebutton', { name: '작업 위치 지도' }),
    );

    expect(openURL).toHaveBeenLastCalledWith(
      expect.stringMatching(
        /^https:\/\/map\.kakao\.com\/link\/map\/[^/]+,37\.556151,126\.922803$/,
      ),
    );
  });

  it('서버가 좌표를 구하지 못한 작업은 회색 자리만 두고, 길찾기는 주소로 연다', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderSignedInApp({ workRepository: repositoryWithLocation(null) });
    await openStartedWorkDetail();

    expect(screen.queryByRole('imagebutton')).not.toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: '길찾기' }));

    expect(openURL).toHaveBeenCalledWith(
      expect.stringMatching(/^(https:\/\/maps\.apple\.com\/\?q=|geo:0,0\?q=)/),
    );
  });
});
