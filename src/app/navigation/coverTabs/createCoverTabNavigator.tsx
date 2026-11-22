import type {
  BottomTabNavigationEventMap,
  BottomTabNavigationOptions,
  BottomTabNavigatorProps,
  BottomTabTypeBag,
} from '@react-navigation/bottom-tabs';
import {
  createNavigatorFactory,
  TabRouter,
  useNavigationBuilder,
  type NavigatorTypeBagBase,
  type ParamListBase,
  type TabActionHelpers,
  type TabNavigationState,
  type TabRouterOptions,
  type TypedNavigator,
} from '@react-navigation/native';
import { CoverTabView } from './CoverTabView';

// 메인 탭 내비게이터 (#216). createBottomTabNavigator 와 같은 TabRouter·옵션·이벤트·tabBar·layout·screenLayout 을 쓰고,
// 화면만 CoverTabView 가 그린다 (덮기 전환). 옵션 중 headerShown 외의 장면·헤더 옵션(animation, lazy 등)은 쓰지 않는다
function CoverTabNavigator({
  id,
  initialRouteName,
  backBehavior,
  UNSTABLE_routeNamesChangeBehavior,
  children,
  layout,
  screenListeners,
  screenOptions,
  screenLayout,
  UNSTABLE_router,
  tabBar,
}: BottomTabNavigatorProps) {
  const { state, descriptors, navigation, render } = useNavigationBuilder<
    TabNavigationState<ParamListBase>,
    TabRouterOptions,
    TabActionHelpers<ParamListBase>,
    BottomTabNavigationOptions,
    BottomTabNavigationEventMap
  >(TabRouter, {
    id,
    initialRouteName,
    backBehavior,
    UNSTABLE_routeNamesChangeBehavior,
    children,
    layout,
    screenListeners,
    screenOptions,
    screenLayout,
    UNSTABLE_router,
  });

  return render(
    <CoverTabView
      state={state}
      navigation={navigation}
      descriptors={descriptors}
      tabBar={tabBar ?? noTabBar}
    />,
  );
}

const noTabBar = () => null;

type CoverTabTypeBag<ParamList extends ParamListBase> = Omit<
  BottomTabTypeBag<ParamList>,
  'Navigator'
> & { Navigator: typeof CoverTabNavigator };

export function createCoverTabNavigator<
  const ParamList extends ParamListBase,
  const TypeBag extends NavigatorTypeBagBase = CoverTabTypeBag<ParamList>,
>(): TypedNavigator<TypeBag> {
  return createNavigatorFactory(CoverTabNavigator)();
}
