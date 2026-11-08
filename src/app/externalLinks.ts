import { Linking, Platform } from 'react-native';
import type { GeoPoint } from '../features/work/model';

// 처리할 앱이 없으면 조용히 넘어간다 (안내 UI 는 추후)
const openExternal = (url: string) => {
  Linking.openURL(url).catch(() => {});
};

export const callPhone = (phone: string) => openExternal(`tel:${phone}`);

/** 작업 현장. 좌표는 서버가 주소에서 구한 값이고 없을 수 있다 */
export type Place = { address: string; location: GeoPoint | null };

type AppAndWeb = { app: string; web: string };

/**
 * 카카오맵 연결 주소 (#67).
 * 앱: 카카오맵 URL Scheme (apis.map.kakao.com/ios_v2·android_v2 › 카카오맵 URL Scheme, 지도앱 6.0.0+)
 *   - look?p=위도,경도: 그 좌표 중심으로 지도를 보여 주고 마커를 표시한다
 *   - route?ep=위도,경도&by=car: 목적지를 그 좌표로 둔 자동차 길찾기 (출발지 sp 는 넣지 않는다. 기사의 현재 위치를 앱이 모른다)
 * 웹: 지도 URL (apis.map.kakao.com/web/guide › 지도 URL). 모바일에서는 모바일웹 카카오맵으로 이어진다
 *   - link/map/이름,위도,경도: 그 위치를 표시한 지도, link/to/이름,위도,경도: 그 위치를 목적지로 둔 길찾기
 */
export function kakaoMapLinks(
  { latitude, longitude }: GeoPoint,
  name: string,
): { map: AppAndWeb; route: AppAndWeb } {
  const point = `${latitude},${longitude}`;
  // 웹 경로는 '이름,위도,경도' 를 쉼표로 나눈다
  const label = encodeURIComponent(name.replace(/,/g, ' '));
  return {
    map: {
      app: `kakaomap://look?p=${point}`,
      web: `https://map.kakao.com/link/map/${label},${point}`,
    },
    route: {
      app: `kakaomap://route?ep=${point}&by=car`,
      web: `https://map.kakao.com/link/to/${label},${point}`,
    },
  };
}

// 카카오맵 앱이 없으면 열기가 거절된다 (iOS openURL 완료 false, Android 처리할 액티비티 없음). 그때 웹 카카오맵을 연다.
// 거절을 보고 고르므로 설치 여부를 미리 묻지 않는다 (iOS LSApplicationQueriesSchemes·Android <queries> 불필요)
const openAppOrWeb = ({ app, web }: AppAndWeb) => {
  Linking.openURL(app).catch(() => openExternal(web));
};

/** 작업 위치 지도를 누르면 카카오맵에서 그 마커 위치를 연다. 좌표가 없으면 지도가 없어 열지 않는다 */
export const openMap = ({ address, location }: Place) => {
  if (location) {
    openAppOrWeb(kakaoMapLinks(location, address).map);
  }
};

/**
 * 길찾기. 좌표가 있으면 카카오맵 길찾기(목적지 = 현장 좌표)를 연다.
 * 서버가 좌표를 구하지 못한 작업은 지금처럼 주소로 기기 지도 앱을 연다
 */
export const openDirections = ({ address, location }: Place) => {
  if (location) {
    openAppOrWeb(kakaoMapLinks(location, address).route);
    return;
  }
  openExternal(
    `${
      Platform.OS === 'ios' ? 'https://maps.apple.com/?q=' : 'geo:0,0?q='
    }${encodeURIComponent(address)}`,
  );
};

export const openWebPage = (url: string) => openExternal(url);
