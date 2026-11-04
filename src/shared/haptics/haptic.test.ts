import { Platform } from 'react-native';
import RNHapticFeedback from 'react-native-haptic-feedback';
import { haptic } from './haptic';

// 라이브러리는 jest/setup.js 의 전역 목
const trigger = jest.mocked(RNHapticFeedback.trigger);

beforeEach(() => trigger.mockReset());
afterEach(() => jest.restoreAllMocks());

const asAndroid = (version: number) => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(version);
};

describe('ios', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'ios');
  });

  it('success·warning·selection·toggle 은 UIKit 생성기 종류를 울린다', () => {
    haptic.success();
    haptic.warning();
    haptic.selection();
    haptic.toggle(true);
    haptic.toggle(false);
    expect(trigger.mock.calls).toEqual([
      ['notificationSuccess'],
      ['notificationWarning'],
      ['selection'],
      ['selection'],
      ['selection'],
    ]);
  });

  it('시스템 설정을 따르도록 옵션을 넘기지 않는다', () => {
    haptic.success();
    expect(trigger.mock.calls[0]).toHaveLength(1);
  });
});

// 라이브러리 Android 구현은 View 상수 맵에 있는 종류만 시스템 터치 진동 설정을 따른다.
// 맵에 없으면 Vibrator 폴백(설정 무시)이라, 그 API 레벨의 맵에 있는 종류만 쓴다
describe('android — API 레벨별 View 상수', () => {
  it.each([
    [24, 'virtualKey', 'longPress', 'contextClick'],
    [29, 'virtualKey', 'longPress', 'contextClick'],
    [30, 'confirm', 'reject', 'segmentTick'],
    [34, 'confirm', 'reject', 'segmentTick'],
  ])('API %i: success·warning·selection', (v, success, warning, selection) => {
    asAndroid(v);
    haptic.success();
    haptic.warning();
    haptic.selection();
    expect(trigger.mock.calls).toEqual([[success], [warning], [selection]]);
  });

  it.each([
    [24, 'contextClick', 'clockTick'],
    [33, 'contextClick', 'clockTick'],
    [34, 'toggleOn', 'toggleOff'],
  ])('API %i: toggle 켬·끔', (v, on, off) => {
    asAndroid(v);
    haptic.toggle(true);
    haptic.toggle(false);
    expect(trigger.mock.calls).toEqual([[on], [off]]);
  });

  it('시스템 설정을 따르도록 옵션을 넘기지 않는다', () => {
    asAndroid(34);
    haptic.success();
    expect(trigger.mock.calls[0]).toHaveLength(1);
  });
});

it('라이브러리 호출이 던져도 아무 일 없다', () => {
  trigger.mockImplementation(() => {
    throw new Error('no haptics');
  });
  expect(() => haptic.success()).not.toThrow();
});
