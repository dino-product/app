// Figma Design.v0 › DesignSystem › 변수 컬렉션 "Variable collection" 과 1:1 대응한다.
// Figma 변수명 `InProgress/2` → `colors.inProgress[2]`. 값을 바꿀 때는 Figma 와 함께 바꾼다.

const HEX_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

export function withOpacity(hex: string, opacity: number): string {
  const match = HEX_PATTERN.exec(hex);
  if (!match) {
    throw new Error(`6자리 hex 색상이어야 합니다: ${hex}`);
  }
  const [r, g, b] = match.slice(1).map(channel => parseInt(channel, 16));
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export const colors = {
  primary: '#1C1B2A',
  primary100: '#A99FFF',
  secondary: '#6452FD',

  gray: {
    0: '#FFFFFF',
    50: '#F4F4F4',
    100: '#E9E9EA',
    200: '#DEDEDE',
    300: '#CECECE',
    400: '#AAAAAA',
    500: '#9B9B9B',
    600: '#767676',
    700: '#585858',
    800: '#404040',
    900: '#222222',
  },
  white: {
    100: '#FFFFFF',
    60: withOpacity('#FFFFFF', 0.6),
    9: withOpacity('#FFFFFF', 0.09),
  },
  background: {
    1: '#EDEDED',
    2: '#F1F1F6',
    3: '#F5F6F8',
    4: withOpacity('#000000', 0.04),
  },

  // 작업 상태
  registered: { 1: '#6C6C6C', 2: '#EDEDED' },
  pending: { 1: '#1F1F1F', 2: '#CECECE', 3: withOpacity('#CECECE', 0.5) },
  accepted: { 1: '#4F3BFE', 2: withOpacity('#4F3BFE', 0.14) },
  confirmed: '#ECE5FE',
  inProgress: {
    1: '#EEA216',
    2: withOpacity('#EEA216', 0.2),
    3: withOpacity('#EEA216', 0.5),
    4: '#FFEBC5',
    5: '#944F00',
    6: withOpacity('#EEA216', 0.06),
  },
  delayed: { 1: '#843E0B', 2: '#FCDCC6' },
  completed: { 1: '#277D02', 2: withOpacity('#3DBC07', 0.2) },
  warning: { 1: '#D71A29', 2: '#FEEDED' },
  select: { 1: withOpacity('#4F3BFE', 0.06) },

  // 작업 유형
  install: { 1: '#7244D8', 2: withOpacity('#8C5CF5', 0.2) },
  repair: { 1: '#F59E0A', 2: withOpacity('#F59E0A', 0.2) },
  inspection: { 1: '#2771E7', 2: withOpacity('#2771E7', 0.2) },
  typeColor: {
    gray: '#6F829C',
    green: '#70B470',
    purple: '#7244D8',
    brown: '#975A32',
    yellow: '#E8A934',
    pink: '#EE87AD',
    red: '#EF6B5A',
    blue: '#618EED',
  },

  support: {
    select1: withOpacity('#D4EFFF', 0.89),
    select2: withOpacity('#EBEAF0', 0.17),
    sideBarIcon: '#898EAE',
  },

  // 이 컬렉션 밖에서 컴포넌트에 직접 쓰인 값
  black: '#000000', // Tab Bar 활성 라벨, 메인화면 헤더
  mainText: '#2A2A2A', // "메인 문구" — 작업 상세 헤더 제목
  inactive: '#F0F0F0', // "비활성화 색" — Bottom Navigation Bar 테두리
  toggleKnob: '#F2F2F2', // 라이브러리 "Gray100" (로컬 Gray100 #E9E9EA 와 다름) — Toggle Off 노브
} as const;
