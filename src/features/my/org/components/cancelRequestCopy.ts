// 신청 취소 확인 문구. 신청 현황의 바텀 시트(2889:13197)와 참여 요청을 보냈어요의 가운데 모달(#98)이 같이 쓴다

/** 보이는 제목 (두 줄) */
export const cancelRequestTitle = (organizationName: string) =>
  `${organizationName} 참여 신청을\n취소할까요?`;

/** 스크린리더가 읽는 제목 (줄바꿈 없이) */
export const cancelRequestTitleLabel = (organizationName: string) =>
  `${organizationName} 참여 신청을 취소할까요?`;

export const cancelRequestMessage =
  '취소하면 사무실의 승인 대기 목록에서도 사라져요.\n같은 회사 코드로 언제든 다시 신청할 수 있어요.';
