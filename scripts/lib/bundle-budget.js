function evaluateBundleSize({ platform, bytes, maxKb }) {
  const kb = bytes / 1024;
  return { platform, kb, maxKb, usage: kb / maxKb, withinBudget: kb <= maxKb };
}

function formatBundleReport(results) {
  return results
    .map(
      ({ platform, kb, maxKb, usage, withinBudget }) =>
        `${withinBudget ? '✅' : '❌'} ${platform}: ${kb.toFixed(
          1,
        )} KB / ${maxKb} KB (${(usage * 100).toFixed(1)}%)`,
    )
    .join('\n');
}

module.exports = { evaluateBundleSize, formatBundleReport };
