import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  makeNotificationsMock,
  membershipsMock,
  notificationSettingsMock,
  pendingParticipationRequestsMock,
  profileMock,
} from './mockData';
import type {
  AppNotification,
  Membership,
  NotificationSettings,
  Profile,
  ProfileInput,
} from './model';

// 마이 탭 화면을 오가도 남아야 하는 상태. API 연동 전까지 목 데이터로 들고 있는다.
// 마이 탭 스택을 감싸므로 로그아웃·탈퇴로 첫 화면에 돌아가면(탭을 새로 만듦) 처음 값으로 돌아간다
type MyState = {
  profile: Profile;
  memberships: readonly Membership[];
  pendingRequestCount: number;
  notificationSettings: NotificationSettings;
  notifications: readonly AppNotification[];
  updateProfile: (input: ProfileInput) => void;
  setNotificationSetting: (
    key: keyof NotificationSettings,
    value: boolean,
  ) => void;
  markNotificationRead: (id: string) => void;
};

const MyStateContext = createContext<MyState | null>(null);

export function MyStateProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState(profileMock);
  const [notificationSettings, setNotificationSettings] = useState(
    notificationSettingsMock,
  );
  const [notifications, setNotifications] = useState(() =>
    makeNotificationsMock(new Date()),
  );

  const updateProfile = useCallback(
    (input: ProfileInput) => setProfile(current => ({ ...current, ...input })),
    [],
  );
  const setNotificationSetting = useCallback(
    (key: keyof NotificationSettings, value: boolean) =>
      setNotificationSettings(current => ({ ...current, [key]: value })),
    [],
  );
  const markNotificationRead = useCallback(
    (id: string) =>
      setNotifications(current =>
        current.map(item => (item.id === id ? { ...item, read: true } : item)),
      ),
    [],
  );

  const value = useMemo(
    () => ({
      profile,
      memberships: membershipsMock,
      pendingRequestCount: pendingParticipationRequestsMock,
      notificationSettings,
      notifications,
      updateProfile,
      setNotificationSetting,
      markNotificationRead,
    }),
    [
      profile,
      notificationSettings,
      notifications,
      updateProfile,
      setNotificationSetting,
      markNotificationRead,
    ],
  );

  return (
    <MyStateContext.Provider value={value}>{children}</MyStateContext.Provider>
  );
}

export function useMyState(): MyState {
  const value = useContext(MyStateContext);
  if (value === null) {
    throw new Error('MyStateProvider 안에서만 쓸 수 있다');
  }
  return value;
}
