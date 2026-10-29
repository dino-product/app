import { useEffect, useState } from 'react';
import { BackHandler, Linking, Platform, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  currentWork,
  weeklySchedule,
  workDetail,
} from '../features/work/mockData';
import { formatResultTime } from '../features/work/model';
import { WorkDetailScreen } from '../features/work/screens/WorkDetailScreen';
import { WorkHomeScreen } from '../features/work/screens/WorkHomeScreen';
import { useFrameMonitor } from '../shared/perf/useFrameMonitor';

// 내비게이션 라이브러리와 API 를 붙이기 전까지 목 데이터로 메인화면 ↔ 작업 상세만 오간다.
export default function App() {
  const [openWorkId, setOpenWorkId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  useFrameMonitor();

  const goHome = () => setOpenWorkId(null);

  // Android 하드웨어 뒤로가기: 상세에서는 메인화면으로
  useEffect(() => {
    if (!openWorkId) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setOpenWorkId(null);
        return true;
      },
    );
    return () => subscription.remove();
  }, [openWorkId]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      {openWorkId ? (
        // 목 데이터라 어떤 작업을 열어도 같은 상세를 보여준다. key 로 작업이 바뀌면 보고 입력을 비운다
        <WorkDetailScreen
          key={openWorkId}
          work={workDetail}
          onBack={goHome}
          onDone={goHome}
          onSubmitReport={() => ({
            kind: 'submitted',
            at: formatResultTime(new Date()),
          })}
          onCall={phone => Linking.openURL(`tel:${phone}`)}
          onNavigate={address =>
            Linking.openURL(
              `${
                Platform.OS === 'ios' ? 'maps:0,0?q=' : 'geo:0,0?q='
              }${encodeURIComponent(address)}`,
            )
          }
          // 카메라·앨범 연동 전까지 회색 자리 사진을 넣는다
          onPickPhoto={async () => `mock://photo-${Date.now()}`}
        />
      ) : (
        <WorkHomeScreen
          currentWork={currentWork}
          schedule={weeklySchedule}
          weekLabel="9. 14. – 9. 20."
          started={started}
          onStartWork={() => setStarted(true)}
          onOpenWork={setOpenWorkId}
        />
      )}
    </SafeAreaProvider>
  );
}
