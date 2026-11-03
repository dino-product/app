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
import { participationRequestsMock } from './org/mockData';
import {
  useParticipationStore,
  type ParticipationStore,
} from './org/useParticipationStore';

// 마이 탭 화면을 오가도 남아야 하는 상태. API 연동 전까지 목 데이터로 들고 있는다.
// 마이 탭 스택을 감싸므로 로그아웃·탈퇴로 첫 화면에 돌아가면(탭을 새로 만듦) 처음 값으로 돌아간다
type ProfileState = {
  profile: Profile;
  memberships: readonly Membership[];
  updateProfile: (input: ProfileInput) => void;
};

// 조직 참여 (#73). 내가 보낸 모든 참여 요청(승인 대기·거절·취소 …)과 회사 조회·요청·취소
type ParticipationState = Omit<ParticipationStore, 'decideRequest'>;

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
const ParticipationContext = createContext<ParticipationState | null>(null);

export function MyStateProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState(profileMock);
  const [notificationSettings, setNotificationSettings] = useState(
    notificationSettingsMock,
  );
  const [notifications, setNotifications] = useState(() =>
    makeNotificationsMock(new Date()),
  );

  const { requests, lookupCompany, requestParticipation, cancelRequest } =
    useParticipationStore(participationRequestsMock, membershipsMock);

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
  const participationState = useMemo(
    () => ({ requests, lookupCompany, requestParticipation, cancelRequest }),
    [requests, lookupCompany, requestParticipation, cancelRequest],
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
          <ParticipationContext.Provider value={participationState}>
            {children}
          </ParticipationContext.Provider>
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
export const useParticipation = () => useRequired(ParticipationContext);
