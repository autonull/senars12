/**
 * RL Baseline Reporter — generates reports from baseline experiments.
 */

import type { ExperimentResult, ArmComparison } from './Comparator';
import type { ArmMetrics } from './Metrics';
import type { BaselineArmConfig } from '../baselines';

/** Report format options. */
export interface ReportOptions {
  /** Include detailed episode data. */
  includeEpisodes?: boolean;
  /** Include statistical details. */
  includeStatistics?: boolean;
  /** Output format. */
  format?: 'text' | 'markdown' | 'json' | 'html';
}

/** Generate a text report from experiment results. */
export function generateReport(
  result: ExperimentResult,
  options: ReportOptions = {}
): string {
  const { format = 'text', includeStatistics = true } = options;

  switch (format) {
    case 'markdown':
      return generateMarkdownReport(result, options);
    case 'json':
      return generateJsonReport(result);
    case 'html':
      return generateHtmlReport(result, options);
    default:
      return generateTextReport(result, options);
  }
}

function generateTextReport(result: ExperimentResult, options: ReportOptions): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push(`RL BASELINE EXPERIMENT REPORT: ${result.experimentName}`);
  lines.push('='.repeat(60));
  lines.push('');

  if (result.experimentConfig.description) {
    lines.push(`Description: ${result.experimentConfig.description}`);
    lines.push('');
  }

  lines.push(`Started: ${new Date(result.startedAt).toISOString()}`);
  lines.push(`Completed: ${new Date(result.completedAt).toISOString()}`);
  lines.push(`Duration: ${((result.completedAt - result.startedAt) / 1000).toFixed(1)}s`);
  lines.push(`Total Episodes: ${result.totalEpisodes}`);
  lines.push('');

  lines.push('-'.repeat(60));
  lines.push('ARM METRICS');
  lines.push('-'.repeat(60));
  lines.push('');

  for (const [name, metrics] of result.armResults) {
    lines.push(`Arm: ${name}`);
    lines.push(`  Algorithm: ${metrics.armConfig.algorithm}`);
    lines.push(`  Episodes: ${metrics.totalEpisodes}`);
    lines.push(`  Total Reward: ${metrics.totalReward.toFixed(2)}`);
    lines.push(`  Avg Reward: ${metrics.avgReward.toFixed(4)}`);
    lines.push(`  Win Rate: ${(metrics.winRate * 100).toFixed(1)}%`);
    lines.push(`  Reward StdDev: ${metrics.rewardStdDev.toFixed(4)}`);
    lines.push(`  Brier Score: ${metrics.brierScore.toFixed(4)}`);
    lines.push(`  Regret: ${metrics.regret.toFixed(2)}`);
    lines.push(`  Calibration Error: ${metrics.calibrationError.toFixed(4)}`);
    lines.push(`  Reward CI: [${metrics.rewardCI[0].toFixed(4)}, ${metrics.rewardCI[1].toFixed(4)}]`);
    lines.push(`  Win Rate CI: [${(metrics.winRateCI[0] * 100).toFixed(1)}%, ${(metrics.winRateCI[1] * 100).toFixed(1)}%]`);
    lines.push('');
  }

  lines.push('-'.repeat(60));
  lines.push('PAIRWISE COMPARISONS');
  lines.push('-'.repeat(60));
  lines.push('');

  for (const comp of result.comparisons) {
    lines.push(`${comp.armA} vs ${comp.armB}`);
    lines.push(`  p-value: ${comp.pValue.toExponential(3)}`);
    lines.push(`  Significant: ${comp.significant ? 'YES' : 'NO'}`);
    lines.push(`  Effect Size (Cohen's d): ${comp.effectSize.toFixed(3)}`);
    lines.push(`  Better: ${comp.betterArm === 'tie' ? 'Tie' : comp.betterArm === 'A' ? comp.armA : comp.armB}`);
    lines.push('');
  }

  lines.push('-'.repeat(60));
  lines.push(`BEST ARM: ${result.bestArm}`);
  lines.push('='.repeat(60));

  return lines.join('\n');
}

function generateMarkdownReport(result: ExperimentResult, options: ReportOptions): string {
  const lines: string[] = [];

  lines.push(`# RL Baseline Experiment: ${result.experimentName}`);
  lines.push('');

  if (result.experimentConfig.description) {
    lines.push(`> ${result.experimentConfig.description}`);
    lines.push('');
  }

  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Started | ${new Date(result.startedAt).toISOString()} |`);
  lines.push(`| Completed | ${new Date(result.completedAt).toISOString()} |`);
  lines.push(`| Duration | ${((result.completedAt - result.startedAt) / 1000).toFixed(1)}s |`);
  lines.push(`| Total Episodes | ${result.totalEpisodes} |`);
  lines.push('');

  lines.push('## Arm Metrics');
  lines.push('');

  lines.push('| Arm | Algorithm | Episodes | Avg Reward | Win Rate | Brier Score | Regret | Calibration |');
  lines.push('|-----|-----------|----------|------------|----------|-------------|--------|-------------|');

  for (const [name, metrics] of result.armResults) {
    lines.push(`| ${name} | ${metrics.armConfig.algorithm} | ${metrics.totalEpisodes} | ${metrics.avgReward.toFixed(4)} | ${(metrics.winRate * 100).toFixed(1)}% | ${metrics.brierScore.toFixed(4)} | ${metrics.regret.toFixed(2)} | ${metrics.calibrationError.toFixed(4)} |`);
  }

  lines.push('');

  lines.push('## Pairwise Comparisons');
  lines.push('');

  lines.push('| Comparison | p-value | Significant | Effect Size | Better |');
  lines.push('|------------|---------|-------------|-------------|--------|');

  for (const comp of result.comparisons) {
    lines.push(`| ${comp.armA} vs ${comp.armB} | ${comp.pValue.toExponential(3)} | ${comp.significant ? '✅' : '❌'} | ${comp.effectSize.toFixed(3)} | ${comp.betterArm === 'tie' ? 'Tie' : comp.betterArm === 'A' ? comp.armA : comp.armB} |`);
  }

  lines.push('');

  lines.push(`## Best Arm: **${result.bestArm}**`);

  return lines.join('\n');
}

function generateJsonReport(result: ExperimentResult): string {
  return JSON.stringify({
    experimentName: result.experimentName,
    experimentConfig: result.experimentConfig,
    armResults: Object.fromEntries(result.armResults),
    comparisons: result.comparisons,
    bestArm: result.bestArm,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    totalEpisodes: result.totalEpisodes,
  }, null, 2);
}

function generateHtmlReport(result: ExperimentResult, options: ReportOptions): string {
  const textReport = generateTextReport(result, options);
  return `<!DOCTYPE html>
<html>
<head>
  <title>RL Baseline Report: ${result.experimentName}</title>
  <style>
    body { font-family: monospace; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>RL Baseline Experiment: ${result.experimentName}</h1>
  <pre>${textReport.replace(/</g, '<').replace(/>/g, '>')}</pre>
</body>
</html>`;
}

/** Generate a summary card for an arm. */
export function generateArmCard(metrics: ArmMetrics): string {
  return `
╔═══════════════════════════════════════════════╗
║  ${metrics.armConfig.name.padEnd(40)} ║
╠═══════════════════════════════════════════════╣
║  Algorithm: ${metrics.armConfig.algorithm.padEnd(30)} ║
║  Episodes: ${metrics.totalEpisodes.toString().padStart(30)} ║
║  Avg Reward: ${metrics.avgReward.toFixed(4).padStart(28)} ║
║  Win Rate: ${(metrics.winRate * 100).toFixed(1).padStart(30)}% ║
║  Brier Score: ${metrics.brierScore.toFixed(4).padStart(27)} ║
║  Regret: ${metrics.regret.toFixed(2).padStart(32)} ║
╚═══════════════════════════════════════════════╝`;
}

/** Generate a comparison card. */
export function generateComparisonCard(comp: ArmComparison): string {
  return `
╔═══════════════════════════════════════════════╗
║  ${(comp.armA + ' vs ' + comp.armB).padEnd(40)} ║
╠═══════════════════════════════════════════════╣
║  p-value: ${comp.pValue.toExponential(3).padStart(30)} ║
║  Significant: ${(comp.significant ? 'YES' : 'NO').padStart(28)} ║
║  Effect Size: ${comp.effectSize.toFixed(3).padStart(28)} ║
║  Better: ${(comp.betterArm === 'tie' ? 'Tie' : comp.betterArm === 'A' ? comp.armA : comp.armB).padStart(32)} ║
╚═══════════════════════════════════════════════╝`;
}