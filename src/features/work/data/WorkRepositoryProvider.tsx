import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useApiClient } from '../../../shared/api';
import { createWorkRepository } from './config';
import type { WorkRepository } from './types';

// 고른 작업 저장소를 앱에 준다 (ApiProvider 안). 화면은 data/queries.ts 의 훅을 쓴다.
// 저장소는 처음 그릴 때 한 번 만들고 바꾸지 않아 이 Provider 때문에 아래가 다시 그려지지 않는다.
// 로그아웃·만료·탈퇴 때 저장소를 처음으로 돌리는 일(reset)은 AuthProvider 의 resetToSignedOut 이 서버 상태 캐시와 함께 한다

const WorkRepositoryContext = createContext<WorkRepository | null>(null);

export function WorkRepositoryProvider({
  repository,
  children,
}: {
  /** 테스트가 가짜 저장소를 준다. 없으면 config 의 운영 저장소(기사 작업 API) */
  repository?: WorkRepository;
  children?: ReactNode;
}) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [selected] = useState(
    () => repository ?? createWorkRepository({ api, queryClient }),
  );

  return (
    <WorkRepositoryContext.Provider value={selected}>
      {children}
    </WorkRepositoryContext.Provider>
  );
}

export function useWorkRepository(): WorkRepository {
  const repository = useContext(WorkRepositoryContext);
  if (repository === null) {
    throw new Error('WorkRepositoryProvider 안에서만 쓸 수 있다');
  }
  return repository;
}
