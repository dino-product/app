import { delay } from './delay';

afterEach(() => {
  jest.useRealTimers();
});

describe('delay', () => {
  it('ms 뒤에 풀리고 타이머를 남기지 않는다', async () => {
    jest.useFakeTimers();
    const done = jest.fn();

    delay(1_000).then(done);
    await jest.advanceTimersByTimeAsync(999);
    expect(done).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);

    expect(done).toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('기다리는 동안 취소되면 바로 AbortError 로 끝내고 타이머를 지운다', async () => {
    jest.useFakeTimers();
    const controller = new AbortController();

    const waiting = delay(5_000, controller.signal).catch(error => error);
    controller.abort();

    await expect(waiting).resolves.toMatchObject({ name: 'AbortError' });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('이미 취소된 signal 이면 기다리지 않는다', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(delay(5_000, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
