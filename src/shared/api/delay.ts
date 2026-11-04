// 다시 보내기 전에 기다린다 (503 Retry-After, 재발급 재시도). 사용법: `await delay(ms, signal)`
// signal 이 취소되면 기다리지 않고 fetch 처럼 AbortError 로 끝낸다

const abortError = () =>
  Object.assign(new Error('Aborted'), { name: 'AbortError' });

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const cancel = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', cancel);
      resolve();
    }, ms);
    signal?.addEventListener('abort', cancel);
  });
}
