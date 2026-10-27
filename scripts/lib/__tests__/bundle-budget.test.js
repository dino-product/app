const { evaluateBundleSize, formatBundleReport } = require('../bundle-budget');

describe('evaluateBundleSize', () => {
  it('예산 이내면 withinBudget=true 와 사용률을 반환한다', () => {
    expect(
      evaluateBundleSize({ platform: 'ios', bytes: 1024 * 1024, maxKb: 2048 }),
    ).toEqual({
      platform: 'ios',
      kb: 1024,
      maxKb: 2048,
      usage: 0.5,
      withinBudget: true,
    });
  });

  it('예산과 정확히 같으면 통과로 본다', () => {
    expect(
      evaluateBundleSize({
        platform: 'android',
        bytes: 2048 * 1024,
        maxKb: 2048,
      }).withinBudget,
    ).toBe(true);
  });

  it('예산을 1바이트라도 넘으면 실패한다', () => {
    expect(
      evaluateBundleSize({
        platform: 'android',
        bytes: 2048 * 1024 + 1,
        maxKb: 2048,
      }).withinBudget,
    ).toBe(false);
  });
});

describe('formatBundleReport', () => {
  it('플랫폼별 크기, 예산, 사용률, 결과를 한 줄씩 보여준다', () => {
    const report = formatBundleReport([
      {
        platform: 'ios',
        kb: 865.1,
        maxKb: 2048,
        usage: 0.4224,
        withinBudget: true,
      },
      {
        platform: 'android',
        kb: 2100,
        maxKb: 2048,
        usage: 1.0254,
        withinBudget: false,
      },
    ]);

    expect(report).toBe(
      [
        '✅ ios: 865.1 KB / 2048 KB (42.2%)',
        '❌ android: 2100.0 KB / 2048 KB (102.5%)',
      ].join('\n'),
    );
  });
});
