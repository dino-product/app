import { Linking, Platform } from 'react-native';

// 처리할 앱이 없으면 조용히 넘어간다 (안내 UI 는 추후)
const openExternal = (url: string) => {
  Linking.openURL(url).catch(() => {});
};

export const callPhone = (phone: string) => openExternal(`tel:${phone}`);

export const openDirections = (address: string) =>
  openExternal(
    `${
      Platform.OS === 'ios' ? 'https://maps.apple.com/?q=' : 'geo:0,0?q='
    }${encodeURIComponent(address)}`,
  );
