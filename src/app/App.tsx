import { useEffect, useState } from 'react';
import {
  BackHandler,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  makeScheduleMock,
  requestToWorkDetail,
} from '../features/schedule/mockData';
import { RejectReasonScreen } from '../features/schedule/screens/RejectReasonScreen';
import { RequestDetailScreen } from '../features/schedule/screens/RequestDetailScreen';
import { ScheduleScreen } from '../features/schedule/screens/ScheduleScreen';
import { useScheduleStore } from '../features/schedule/useScheduleStore';
import {
  currentWork,
  weeklySchedule,
  workDetail,
} from '../features/work/mockData';
import { formatResultTime } from '../features/work/model';
import { WorkDetailScreen } from '../features/work/screens/WorkDetailScreen';
import { WorkHomeScreen } from '../features/work/screens/WorkHomeScreen';
import type { MainTabKey } from '../shared/navigation/mainTabs';
import { useFrameMonitor } from '../shared/perf/useFrameMonitor';

// 처리할 앱이 없으면 조용히 넘어간다 (안내 UI 는 추후)
const openExternal = (url: string) => {
  Linking.openURL(url).catch(() => {});
};

const onCall = (phone: string) => openExternal(`tel:${phone}`);
const onNavigate = (address: string) =>
  openExternal(
    `${
      Platform.OS === 'ios' ? 'https://maps.apple.com/?q=' : 'geo:0,0?q='
    }${encodeURIComponent(address)}`,
  );

// 탭(홈·내 일정) 위에 쌓이는 화면
type Route =
  | { name: 'workDetail'; id: string }
  | { name: 'requestDetail'; id: string }
  | { name: 'rejectReason'; id: string };

// 내비게이션 라이브러리와 API 를 붙이기 전까지 목 데이터와 간단한 화면 스택으로 오간다.
export default function App() {
  const [tab, setTab] = useState<'home' | 'schedule'>('home');
  const [stack, setStack] = useState<Route[]>([]);
  const [started, setStarted] = useState(false);
  const [today] = useState(() => new Date());
  const [initialSchedule] = useState(() => makeScheduleMock(today));
  const schedule = useScheduleStore(initialSchedule);
  useFrameMonitor();

  const push = (route: Route) => setStack(prev => [...prev, route]);
  const pop = () => setStack(prev => prev.slice(0, -1));
  const changeTab = (next: MainTabKey) => {
    // 작업 이력·마이는 아직 화면이 없다
    if (next === 'home' || next === 'schedule') {
      setTab(next);
      setStack([]);
    }
  };

  // Android 하드웨어 뒤로가기: 쌓인 화면이 있으면 하나 닫는다
  const hasStack = stack.length > 0;
  useEffect(() => {
    if (!hasStack) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setStack(prev => prev.slice(0, -1));
        return true;
      },
    );
    return () => subscription.remove();
  }, [hasStack]);

  const top = stack[stack.length - 1];
  const request =
    top && top.name !== 'workDetail'
      ? schedule.pending.find(item => item.id === top.id)
      : undefined;

  const renderTop = () => {
    if (top?.name === 'workDetail') {
      return (
        // 목 데이터라 어떤 작업을 열어도 같은 상세를 보여준다. key 로 작업이 바뀌면 보고 입력을 비운다
        <WorkDetailScreen
          key={top.id}
          work={workDetail}
          onBack={pop}
          onDone={() => {
            // 제출 완료·작업 취소 모두 진행 중 작업이 끝난 것이다
            setStarted(false);
            pop();
          }}
          onSubmitReport={() => ({
            kind: 'submitted',
            at: formatResultTime(new Date()),
          })}
          onCall={onCall}
          onNavigate={onNavigate}
          onTabChange={changeTab}
          // 카메라·앨범 연동 전까지 회색 자리 사진을 넣는다
          onPickPhoto={async () => `mock://photo-${Date.now()}`}
        />
      );
    }
    if (top?.name === 'requestDetail' && request) {
      return (
        <RequestDetailScreen
          work={requestToWorkDetail(request)}
          onBack={pop}
          onAccept={() => {
            schedule.accept(request.id);
            pop();
          }}
          onReject={() => push({ name: 'rejectReason', id: request.id })}
          onCall={onCall}
          onNavigate={onNavigate}
        />
      );
    }
    if (top?.name === 'rejectReason' && request) {
      return (
        <RejectReasonScreen
          onBack={pop}
          onSubmit={() => {
            // 거절 사유는 API 연동 때 서버로 보낸다
            schedule.reject(request.id);
            setStack([]);
          }}
        />
      );
    }
    return null;
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      {/* 네이티브 스택처럼 아래 화면을 유지한 채 위에 덮는다 (탭·선택 날짜·스크롤이 돌아와도 남는다) */}
      <View
        accessibilityElementsHidden={hasStack}
        importantForAccessibility={hasStack ? 'no-hide-descendants' : 'auto'}
        style={styles.fill}
      >
        {tab === 'home' ? (
          <WorkHomeScreen
            currentWork={currentWork}
            schedule={weeklySchedule}
            weekLabel="9. 14. – 9. 20."
            started={started}
            onStartWork={() => setStarted(true)}
            onOpenWork={id => push({ name: 'workDetail', id })}
            onTabChange={changeTab}
          />
        ) : (
          <ScheduleScreen
            today={today}
            confirmed={schedule.confirmed}
            pending={schedule.pending}
            onAccept={schedule.accept}
            onReject={id => push({ name: 'rejectReason', id })}
            onOpenRequest={id => push({ name: 'requestDetail', id })}
            onTabChange={changeTab}
          />
        )}
      </View>
      {hasStack && <View style={styles.overlay}>{renderTop()}</View>}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
});
