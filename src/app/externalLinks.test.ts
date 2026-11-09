import { Linking, Platform } from 'react-native';
import { kakaoMapLinks, openDirections, openMap } from './externalLinks';

// 카카오맵 URL 스킴(apis.map.kakao.com/ios_v2·android_v2 › 카카오맵 URL Scheme)과
// 웹 지도 URL(apis.map.kakao.com/web/guide › 지도 URL)을 쓴다 (#67)
const site = {
  address: '서울 강남구 역삼동 123-4 101호',
  location: { latitude: 37.500622, longitude: 127.036456 },
};

// 앱(URL 스킴)을 먼저 열고, 카카오맵이 없어 거절되면 웹 카카오맵을 연다
const flush = () => new Promise<void>(resolve => setImmediate(() => resolve()));

describe('kakaoMapLinks', () => {
  it('지도는 그 좌표에 마커를 찍은 카카오맵을 연다 (앱 look, 웹 link/map)', () => {
    expect(kakaoMapLinks(site.location, site.address).map).toEqual({
      app: 'kakaomap://look?p=37.500622,127.036456',
      web: `https://map.kakao.com/link/map/${encodeURIComponent(
        site.address,
      )},37.500622,127.036456`,
    });
  });

  it('길찾기는 목적지를 그 좌표로 둔 자동차 길찾기다 (앱 route ep, 웹 link/to)', () => {
    expect(kakaoMapLinks(site.location, site.address).route).toEqual({
      app: 'kakaomap://route?ep=37.500622,127.036456&by=car',
      web: `https://map.kakao.com/link/to/${encodeURIComponent(
        site.address,
      )},37.500622,127.036456`,
    });
  });

  // 웹 URL 은 '이름,위도,경도' 를 쉼표로 나누므로 이름의 쉼표는 띄어쓰기로 바꾼다. '/' 는 인코딩된다
  it('웹 URL 의 장소 이름에서 쉼표를 빼고 경로 문자를 인코딩한다', () => {
    const { web } = kakaoMapLinks(
      site.location,
      '서울 중구 세종대로 110, 3/4층',
    ).map;

    expect(web).toBe(
      `https://map.kakao.com/link/map/${encodeURIComponent(
        '서울 중구 세종대로 110  3/4층',
      )},37.500622,127.036456`,
    );
    expect(web).not.toContain('3/4');
  });
});

describe('카카오맵 열기', () => {
  let openURL: jest.SpyInstance;

  afterEach(() => {
    openURL.mockRestore();
  });

  it('지도를 누르면 카카오맵 앱에서 그 위치를 연다', async () => {
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

    openMap(site);
    await flush();

    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith(
      'kakaomap://look?p=37.500622,127.036456',
    );
  });

  it('카카오맵 앱이 없으면(열기 거절) 웹 카카오맵에서 그 위치를 연다', async () => {
    openURL = jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValueOnce(new Error('no handler'))
      .mockResolvedValue(undefined);

    openMap(site);
    await flush();

    expect(openURL).toHaveBeenNthCalledWith(
      2,
      kakaoMapLinks(site.location, site.address).map.web,
    );
  });

  it('길찾기는 카카오맵 앱 길찾기를, 앱이 없으면 웹 길찾기를 연다', async () => {
    openURL = jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValueOnce(new Error('no handler'))
      .mockResolvedValue(undefined);

    openDirections(site);
    await flush();

    const { route } = kakaoMapLinks(site.location, site.address);
    expect(openURL).toHaveBeenNthCalledWith(1, route.app);
    expect(openURL).toHaveBeenNthCalledWith(2, route.web);
  });

  it('웹도 열지 못하면 조용히 넘어간다 (처리되지 않은 오류 없음)', async () => {
    openURL = jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValue(new Error('no handler'));

    openDirections(site);
    await flush();

    expect(openURL).toHaveBeenCalledTimes(2);
  });

  it('좌표가 없으면 지도를 누를 곳이 없어 아무것도 열지 않는다', async () => {
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

    openMap({ ...site, location: null });
    await flush();

    expect(openURL).not.toHaveBeenCalled();
  });

  // 서버가 좌표를 구하지 못한 작업은 주소로 길찾기한다 (백엔드 WorkDetailResponse.Customer.location 설명)
  it.each([
    ['ios', 'https://maps.apple.com/?q='],
    ['android', 'geo:0,0?q='],
  ] as const)(
    '좌표가 없으면 길찾기는 지금처럼 주소로 지도 앱을 연다 (%s)',
    async (os, prefix) => {
      jest.replaceProperty(Platform, 'OS', os);
      openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

      openDirections({ ...site, location: null });
      await flush();

      expect(openURL).toHaveBeenCalledWith(
        `${prefix}${encodeURIComponent(site.address)}`,
      );
    },
  );
});
