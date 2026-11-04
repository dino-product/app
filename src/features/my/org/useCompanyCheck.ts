import { useEffect, useRef, useState } from 'react';
import type { Notice } from './components/NoticeModal';
import type {
  JoinTarget,
  LookupOutcome,
  Organization,
  RequestChannel,
} from './model';
import {
  alreadyMemberNotice,
  lookupFailureNotice,
  pendingRequestNotice,
} from './notices';
import { useLookupCompany } from './participationQueries';

export type CompanyCheckHandlers = {
  /** 찾은 회사 (회사 코드·찾은 방법을 담은 참여 대상). 역할 선택으로 넘긴다 */
  onFound: (target: JoinTarget) => void;
  /** 승인 대기 중인 요청이 있는 회사일 때. 주면 알림 대신 그 요청 id 와 함께 부른다 (온보딩은 그 요청의 승인 대기로 간다) */
  onPending?: (organization: Organization, requestId: string) => void;
  /**
   * 이미 참여 중인 회사일 때. 주면 먼저 부르고, 처리했으면(true) 알림을 띄우지 않는다.
   * 온보딩은 그 회사의 참여 완료로 돌아간다. 처리하지 못했으면(그 회사의 승인 요청이 없음) 알림을 띄운다
   */
  onAlreadyMember?: (organization: Organization) => Promise<boolean>;
};

/**
 * 회사 확인(GET /api/v1/organizations/lookup, #116)을 보내고 결과를 네 갈래로 나눈다.
 * 회사 코드 입력(회사 찾기)과 QR 인식(#108)이 같이 쓴다.
 * 찾음 → onFound, 승인 대기 → onPending 또는 안내, 이미 참여 → onAlreadyMember 또는 안내, 확인 실패(429·네트워크·서버) → 안내.
 * 유효하지 않은 코드는 화면마다 보여 주는 방법이 달라 check 가 돌려준 갈래로 화면이 정한다.
 * 다시 그리기 전에 연달아 불러도 한 번만 찾고, 찾는 동안 화면을 떠나면 요청을 끊고 늦게 온 결과를 버린다
 */
export function useCompanyCheck({
  onFound,
  onPending,
  onAlreadyMember,
}: CompanyCheckHandlers) {
  const lookup = useLookupCompany();
  const [notice, setNoticeState] = useState<Notice | null>(null);
  const [checking, setChecking] = useState(false);
  // 다시 그리기 전에도 바로 알 수 있게 ref 로도 든다 (isBusy)
  const checkingRef = useRef(false);
  const noticeRef = useRef<Notice | null>(null);
  const setNotice = (next: Notice | null) => {
    noticeRef.current = next;
    setNoticeState(next);
  };
  const mounted = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);

  /** 확인한 갈래. 이미 찾는 중이었거나, 확인하지 못했거나(안내를 띄웠다), 그사이 화면을 떠났으면 null */
  const check = async (
    companyCode: string,
    requestChannel: RequestChannel,
  ): Promise<LookupOutcome['kind'] | null> => {
    if (checkingRef.current) {
      return null;
    }
    checkingRef.current = true;
    setChecking(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      const outcome = await lookup(companyCode, requestChannel, {
        signal: controller.signal,
      });
      if (!mounted.current) {
        return null;
      }
      if (outcome.kind === 'found') {
        onFound(outcome.target);
      } else if (outcome.kind === 'pending') {
        const { organization, requestId } = outcome;
        if (onPending && requestId !== undefined) {
          onPending(organization, requestId);
        } else {
          setNotice(pendingRequestNotice(organization.organizationName));
        }
      } else if (outcome.kind === 'alreadyMember') {
        const { organization } = outcome;
        const handled = (await onAlreadyMember?.(organization)) ?? false;
        if (!handled && mounted.current) {
          setNotice(alreadyMemberNotice(organization.organizationName));
        }
      }
      return mounted.current ? outcome.kind : null;
    } catch (error) {
      if (mounted.current) {
        setNotice(lookupFailureNotice(error));
      }
      return null;
    } finally {
      request.current = null;
      checkingRef.current = false;
      if (mounted.current) {
        setChecking(false);
      }
    }
  };

  return {
    check,
    checking,
    /** 띄운 안내. 화면이 NoticeModal 로 보인다 */
    notice,
    showNotice: setNotice,
    closeNotice: () => setNotice(null),
    /** 확인하는 중이거나 안내가 떠 있는지. 다시 그리기를 기다리지 않는다 (카메라 프레임마다 부르는 QR 인식이 쓴다) */
    isBusy: () => checkingRef.current || noticeRef.current !== null,
  };
}
