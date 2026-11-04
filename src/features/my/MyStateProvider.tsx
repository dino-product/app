import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from 'react';
import {
  makeNotificationsMock,
  membershipsMock,
  notificationSettingsMock,
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
// 조직 참여(회사 확인·참여 요청·신청 현황)는 서버 상태라 여기 두지 않는다 (org/participationQueries, #116).
// 마이 탭 스택을 감싸므로 로그아웃·탈퇴로 첫 화면에 돌아가면(탭을 새로 만듦) 처음 값으로 돌아간다
type ProfileState = {
  profile: Profile;
  memberships: readonly Membership[];
  updateProfile: (input: ProfileInput) => void;
};

type NotificationSettingsState = {
  notificationSettings: NotificationSettings;
  setNotificationSetting: (
    key: keyof NotificationSettings,
    value: boolean,
  ) => void;
};

type NotificationsState = {
  notifications: readonly AppNotification[];
  markNotificationRead: (id: string) => void;
};

const ProfileContext = createContext<ProfileState | null>(null);
const NotificationSettingsContext =
  createContext<NotificationSettingsState | null>(null);
const NotificationsContext = createContext<NotificationsState | null>(null);

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

  // 한쪽이 바뀔 때 스택 아래 다른 화면(마이페이지 등)까지 다시 그리지 않도록 컨텍스트를 나눈다
  const profileState = useMemo(
    () => ({ profile, memberships: membershipsMock, updateProfile }),
    [profile, updateProfile],
  );
  const settingsState = useMemo(
    () => ({ notificationSettings, setNotificationSetting }),
    [notificationSettings, setNotificationSetting],
  );
  const notificationsState = useMemo(
    () => ({ notifications, markNotificationRead }),
    [notifications, markNotificationRead],
  );

  return (
    <ProfileContext.Provider value={profileState}>
      <NotificationSettingsContext.Provider value={settingsState}>
        <NotificationsContext.Provider value={notificationsState}>
          {children}
        </NotificationsContext.Provider>
      </NotificationSettingsContext.Provider>
    </ProfileContext.Provider>
  );
}

function useRequired<T>(context: Context<T | null>): T {
  const value = useContext(context);
  if (value === null) {
    throw new Error('MyStateProvider 안에서만 쓸 수 있다');
  }
  return value;
}

export const useMyProfile = () => useRequired(ProfileContext);
export const useMyNotificationSettings = () =>
  useRequired(NotificationSettingsContext);
export const useMyNotifications = () => useRequired(NotificationsContext);
