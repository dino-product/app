import { Platform } from 'react-native';
import RNHapticFeedback from 'react-native-haptic-feedback';
import { haptic } from './haptic';

jest.mock('react-native-haptic-feedback', () => ({
  __esModule: true,
  default: { trigger: jest.fn() },
}));

const trigger = RNHapticFeedback.trigger as jest.Mock;

beforeEach(() => trigger.mockReset());
afterEach(() => jest.restoreAllMocks());

describe.each([
  ['ios', 'notificationSuccess', 'notificationWarning', 'selection'],
  ['android', 'confirm', 'reject', 'segmentTick'],
] as const)('%s', (os, success, warning, selection) => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', os);
  });

  it('success 는 성공 종류를 울린다', () => {
    haptic.success();
    expect(trigger).toHaveBeenCalledWith(success);
  });

  it('warning 은 경고 종류를 울린다', () => {
    haptic.warning();
    expect(trigger).toHaveBeenCalledWith(warning);
  });

  it('selection 은 선택 종류를 울린다', () => {
    haptic.selection();
    expect(trigger).toHaveBeenCalledWith(selection);
  });

  it('시스템 설정을 따르도록 옵션을 넘기지 않는다', () => {
    haptic.success();
    expect(trigger.mock.calls[0]).toHaveLength(1);
  });
});

describe('toggle', () => {
  it('iOS 는 켜고 꺼도 selection 이다', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    haptic.toggle(true);
    haptic.toggle(false);
    expect(trigger.mock.calls).toEqual([['selection'], ['selection']]);
  });

  it('Android 는 켬/끔을 구분한다', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    haptic.toggle(true);
    haptic.toggle(false);
    expect(trigger.mock.calls).toEqual([['toggleOn'], ['toggleOff']]);
  });
});

it('라이브러리 호출이 던져도 아무 일 없다', () => {
  trigger.mockImplementation(() => {
    throw new Error('no haptics');
  });
  expect(() => haptic.success()).not.toThrow();
});
