import { appStorage, isRecord, readJson, writeJson } from './appStorage';

const KEY = 'test.value';
const parseCount = (value: unknown) =>
  isRecord(value) && typeof value.count === 'number'
    ? { count: value.count }
    : undefined;

describe('appStorage', () => {
  it('저장한 값을 같은 모양으로 읽는다', () => {
    writeJson(KEY, { count: 3 });

    expect(readJson(KEY, parseCount)).toEqual({ count: 3 });
  });

  it('저장한 적이 없으면 undefined 다', () => {
    expect(readJson(KEY, parseCount)).toBeUndefined();
  });

  it('JSON 이 아닌 값은 버리고 지운다', () => {
    appStorage.set(KEY, '{깨진');

    expect(readJson(KEY, parseCount)).toBeUndefined();
    expect(appStorage.contains(KEY)).toBe(false);
  });

  it('모양이 다른 값(앱 업데이트 전 형식 등)은 버리고 지운다', () => {
    writeJson(KEY, { count: '3' });

    expect(readJson(KEY, parseCount)).toBeUndefined();
    expect(appStorage.contains(KEY)).toBe(false);
  });
});
