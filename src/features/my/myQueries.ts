import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../../shared/api';
import { profileQuery } from '../onboarding/profileApi';
import { membershipsQuery } from './memberships';
import { toMyProfile } from './model';
import { useQueryState } from './queryState';

// 마이페이지가 쓰는 서버 상태 (#115). 경로가 부르고 memo 화면(MyPageScreen)에 넘긴다.
// subscribed: 화면이 보이는 동안만 구독한다. 탭을 떠나 있는 동안에는 다시 그리거나 다시 받지 않고, 돌아오면 오래된 값만 다시 받는다

type Options = { subscribed?: boolean };

/** 내 프로필. 켤 때 가입 단계 확인(AuthProvider)이 받아 둔 같은 캐시를 쓴다 */
export function useMyProfile({ subscribed }: Options = {}) {
  const api = useApiClient();
  return useQueryState(
    useQuery({ ...profileQuery(api), select: toMyProfile, subscribed }),
    '프로필을 불러오지 못했어요.',
  );
}

/** 소속 발주사 */
export function useMyMemberships({ subscribed }: Options = {}) {
  const api = useApiClient();
  return useQueryState(
    useQuery({ ...membershipsQuery(api), subscribed }),
    '소속 발주사를 불러오지 못했어요.',
  );
}
