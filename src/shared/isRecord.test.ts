import { isRecord } from './isRecord';

describe('isRecord', () => {
  it('객체만 레코드로 본다', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord('a')).toBe(false);
  });
});
