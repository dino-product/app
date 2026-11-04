import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { JoinTarget, RequestChannel } from '../../features/my/org/model';

/** 참여 요청 화면(요청 완료·승인 대기). 요청 경로는 서버가 돌려주지 않아 이 앱이 방금 보낸 요청에만 있다 (#116) */
type JoinRequestParams = { requestId: string; requestChannel?: RequestChannel };

// 루트 스택은 로그인 상태에 따라 화면 묶음을 바꾼다 (#85, #113, React Navigation 인증 흐름).
// 로그아웃: 로그인 / 가입 단계: 온보딩 / 가입 완료: 메인과 탭 바가 없는 화면(요청 상세·거절 사유)
export type RootStackParamList = {
  Login: undefined;
  /** 가입 단계. 열 화면은 서버 프로필의 nextStep 으로 정한다 (약관 동의면 그 아래에 프로필 등록) */
  Onboarding: NavigatorScreenParams<OnboardingStackParamList> | undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  RequestDetail: { id: string };
  RejectReason: { id: string };
};

// 온보딩 (#85). 하단 탭이 없는 가입 흐름이라 루트 스택에 따로 둔다
export type OnboardingStackParamList = {
  ProfileRegister: undefined;
  TermsAgreement: undefined;
  CompanyFind: undefined;
  /** 참여를 요청할 회사 (회사 코드·찾은 방법) */
  JoinRoleSelect: JoinTarget;
  JoinPending: JoinRequestParams;
  JoinApproved: { requestId: string };
  JoinRejected: { requestId: string };
};

export const ONBOARDING_INITIAL_ROUTE =
  'ProfileRegister' satisfies keyof OnboardingStackParamList;

// 탭 이름은 하단 탭 키(MainTabKey)와 같다 (MainTabBar 가 컴파일 타임에 확인)
export type MainTabParamList = {
  home: NavigatorScreenParams<HomeStackParamList> | undefined;
  /** tab: 바깥에서 하위 탭을 고를 때 (탈퇴 불가 → 응답 필요). 화면이 옮긴 뒤 지운다 */
  schedule: { tab?: 'pending' } | undefined;
  history: NavigatorScreenParams<HistoryStackParamList> | undefined;
  my: NavigatorScreenParams<MyStackParamList> | undefined;
};

// 작업 상세는 Figma 에서 하단 탭이 보이므로 홈 탭 안에 쌓는다.
// 홈의 종으로 여는 알림센터도 홈 탭 안에 쌓아, 뒤로 가면 내 작업 홈으로 돌아온다 (#96)
export type HomeStackParamList = {
  WorkHome: undefined;
  /** id: 작업 id. 알림에서 열면 알림이 생긴 발주사(organizationId)도 넘긴다 (#117) */
  WorkDetail: { id: string; organizationId?: string };
  NotificationCenter: undefined;
};

export const HOME_INITIAL_ROUTE = 'WorkHome' satisfies keyof HomeStackParamList;

// 완료 작업 상세도 작업 상세처럼 하단 탭이 보이므로 작업 이력 탭 안에 쌓는다
export type HistoryStackParamList = {
  WorkHistory: undefined;
  CompletedWorkDetail: { id: string };
};

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
  // 조직 참여 (#73)
  OrgJoin: undefined;
  /** 참여를 요청할 회사 (회사 코드·찾은 방법) */
  OrgRoleSelect: JoinTarget;
  OrgJoinRequested: JoinRequestParams;
  OrgJoinRejected: { requestId: string };
  OrgJoinRequests: undefined;
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

export type HistoryScreenProps<T extends keyof HistoryStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<HistoryStackParamList, T>,
    MainTabScreenProps<'history'>
  >;

export type MyScreenProps<T extends keyof MyStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<MyStackParamList, T>,
    MainTabScreenProps<'my'>
  >;

export type OnboardingScreenProps<T extends keyof OnboardingStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<OnboardingStackParamList, T>,
    RootScreenProps<'Onboarding'>
  >;
