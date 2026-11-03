import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// 탭 바가 없는 화면(요청 상세·거절 사유)은 탭 위의 루트 스택에 둔다
export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  RequestDetail: { id: string };
  RejectReason: { id: string };
};

// 탭 이름은 하단 탭 키(MainTabKey)와 같다 (MainTabBar 가 컴파일 타임에 확인). 작업 이력은 화면이 생기면 더한다
export type MainTabParamList = {
  home: NavigatorScreenParams<HomeStackParamList> | undefined;
  /** tab: 바깥에서 하위 탭을 고를 때 (탈퇴 불가 → 응답 필요). 화면이 옮긴 뒤 지운다 */
  schedule: { tab?: 'pending' } | undefined;
  my: NavigatorScreenParams<MyStackParamList> | undefined;
};

// 작업 상세는 Figma 에서 하단 탭이 보이므로 홈 탭 안에 쌓는다
export type HomeStackParamList = {
  WorkHome: undefined;
  WorkDetail: { id: string };
};

export const HOME_INITIAL_ROUTE = 'WorkHome' satisfies keyof HomeStackParamList;

// 마이페이지 하위 화면도 탭 안에 쌓는다. Figma 는 탈퇴 프레임에만 탭 바가 있지만 한 스택으로 맞췄다 (디자인 확인 항목)
export type MyStackParamList = {
  MyPage: undefined;
  ProfileEdit: undefined;
  NotificationSettings: undefined;
  NotificationCenter: undefined;
  Terms: undefined;
  Account: undefined;
  Withdrawal: undefined;
  WithdrawalBlocked: undefined;
};

export const MY_INITIAL_ROUTE = 'MyPage' satisfies keyof MyStackParamList;

export type RootScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    RootScreenProps<keyof RootStackParamList>
  >;

export type HomeScreenProps<T extends keyof HomeStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<HomeStackParamList, T>,
    MainTabScreenProps<'home'>
  >;

export type MyScreenProps<T extends keyof MyStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<MyStackParamList, T>,
    MainTabScreenProps<'my'>
  >;
