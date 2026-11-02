import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
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
import { lookupCompanyMock, participationRequestsMock } from './org/mockData';
import {
  lookupOutcome,
  type LookupOutcome,
  type Organization,
  type ParticipationRequest,
  type ParticipationType,
} from './org/model';

// 마이 탭 화면을 오가도 남아야 하는 상태. API 연동 전까지 목 데이터로 들고 있는다.
// 마이 탭 스택을 감싸므로 로그아웃·탈퇴로 첫 화면에 돌아가면(탭을 새로 만듦) 처음 값으로 돌아간다
type ProfileState = {
  profile: Profile;
  memberships: readonly Membership[];
  updateProfile: (input: ProfileInput) => void;
};

// 조직 참여 (#73)
type ParticipationState = {
  /** 내가 보낸 모든 참여 요청 (승인 대기·거절·취소 …) */
  requests: readonly ParticipationRequest[];
  /** 회사 코드로 회사를 찾는다 (GET /api/v1/organizations/lookup) */
  lookupCompany: (code: string) => Promise<LookupOutcome>;
  /** 참여를 요청하고 만든 요청을 돌려준다 (POST /api/v1/participation-requests) */
  requestParticipation: (
    organization: Organization,
    desiredType: ParticipationType,
  ) => ParticipationRequest;
  /** 승인 대기 중인 요청을 취소한다 (POST /{requestId}/cancel) */
  cancelRequest: (requestId: string) => void;
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
const ParticipationContext = createContext<ParticipationState | null>(null);

export function MyStateProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState(profileMock);
  const [notificationSettings, setNotificationSettings] = useState(
    notificationSettingsMock,
  );
  const [notifications, setNotifications] = useState(() =>
    makeNotificationsMock(new Date()),
  );

  const [requests, setRequests] = useState(participationRequestsMock);
  const nextRequestNumber = useRef(participationRequestsMock.length + 1);

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

  // 목: 서버 대신 지금 소속·요청으로 판정한다. API 를 붙이면 네트워크 요청이 된다
  const lookupCompany = useCallback(
    async (code: string) =>
      lookupOutcome(lookupCompanyMock(code, membershipsMock, requests)),
    [requests],
  );
  const requestParticipation = useCallback(
    (organization: Organization, desiredType: ParticipationType) => {
      const request: ParticipationRequest = {
        ...organization,
        requestId: `request-${nextRequestNumber.current++}`,
        desiredType,
        status: 'PENDING',
        // QR·참여 링크는 별도 티켓이라 지금은 회사 코드뿐이다
        requestChannel: 'COMPANY_CODE',
        requestedAt: new Date().toISOString(),
      };
      setRequests(current => [...current, request]);
      return request;
    },
    [],
  );
  const cancelRequest = useCallback(
    (requestId: string) =>
      setRequests(current =>
        current.map(item =>
          item.requestId === requestId
            ? { ...item, status: 'CANCELED' as const }
            : item,
        ),
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
