// JSON 으로 받은 값이 객체(배열·null 아님)인지. 저장소·서버 응답의 모양을 볼 때 쓴다. 사용법: `if (isRecord(value)) value.code`

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
