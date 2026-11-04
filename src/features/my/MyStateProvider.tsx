import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from 'react';
import { membershipsMock, profileMock } from './mockData';
import type { Membership, Profile, ProfileInput } from './model';

// 마이 탭 화면을 오가도 남아야 하는 상태. API 연동 전까지 목 데이터로 들고 있는다.
// 조직 참여(회사 확인·참여 요청·신청 현황)는 서버 상태라 여기 두지 않는다 (org/participationQueries, #116).
// 알림센터·알림 설정도 서버 상태다 (notificationQueries, #117).
// 마이 탭 스택을 감싸므로 로그아웃·탈퇴로 첫 화면에 돌아가면(탭을 새로 만듦) 처음 값으로 돌아간다
type ProfileState = {
  profile: Profile;
  memberships: readonly Membership[];
  updateProfile: (input: ProfileInput) => void;
};

const ProfileContext = createContext<ProfileState | null>(null);

export function MyStateProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState(profileMock);

  const updateProfile = useCallback(
    (input: ProfileInput) => setProfile(current => ({ ...current, ...input })),
    [],
  );

  const profileState = useMemo(
    () => ({ profile, memberships: membershipsMock, updateProfile }),
    [profile, updateProfile],
  );

  return (
    <ProfileContext.Provider value={profileState}>
      {children}
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
