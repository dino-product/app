import { colors, withOpacity } from './colors';

describe('withOpacity', () => {
  it('hex 와 불투명도를 rgba 문자열로 바꾼다', () => {
    expect(withOpacity('#EEA216', 0.2)).toBe('rgba(238, 162, 22, 0.2)');
  });

  it('소문자 hex 도 받는다', () => {
    expect(withOpacity('#4f3bfe', 0.14)).toBe('rgba(79, 59, 254, 0.14)');
  });

  it('6자리 hex 가 아니면 에러를 던진다', () => {
    expect(() => withOpacity('#FFF', 0.5)).toThrow('6자리 hex');
  });
});

describe('colors', () => {
  it('Figma 변수와 같은 값을 갖는다', () => {
    expect(colors.primary).toBe('#1C1B2A');
    expect(colors.secondary).toBe('#6452FD');
    expect(colors.gray[900]).toBe('#222222');
    expect(colors.inProgress[2]).toBe('rgba(238, 162, 22, 0.2)');
    expect(colors.white[60]).toBe('rgba(255, 255, 255, 0.6)');
    expect(colors.typeColor.purple).toBe('#7244D8');
  });

  // DesignSystem › Calendar Contents 의 토요일 날짜 (#77)
  it('Figma 변수 Accents/Blue 를 갖는다', () => {
    expect(colors.accents.blue).toBe('#0088FF');
  });

  // 응답 필요 카드 제목 (#77)
  it('Figma 변수 P/T/01 을 갖는다', () => {
    expect(colors.pt01).toBe('#32303A');
  });
});
