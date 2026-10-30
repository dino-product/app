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

// 탭 이름은 하단 탭 키(MainTabKey)와 같다 (MainTabBar 가 컴파일 타임에 확인). 작업 이력·마이는 화면이 생기면 더한다
export type MainTabParamList = {
  home: NavigatorScreenParams<HomeStackParamList> | undefined;
  schedule: undefined;
};

// 작업 상세는 Figma 에서 하단 탭이 보이므로 홈 탭 안에 쌓는다
export type HomeStackParamList = {
  WorkHome: undefined;
  WorkDetail: { id: string };
};

export const HOME_INITIAL_ROUTE = 'WorkHome' satisfies keyof HomeStackParamList;

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
