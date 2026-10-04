/**
 * CLI Statistics Formatting Helpers
 * Shared formatting for NAR, LM, and Agent statistics
 */

import type { NAR } from '@senars/nar';
import type { BinAgentApi as Agent } from '@senars/nar/agent';
import type { LMExecutionStats } from '@senars/util';
import { formatDuration, formatTruth, limitList } from '@senars/util';
import type { LMHandle } from './commands.js';

export interface FormattedStats {
  nar: string;
  lm: string;
}

export function formatLMExecutionStats(lmService: LMHandle): string {
  const lmStats = lmService.getStats();
  const provider = lmService.provider ?? 'unknown';
  const model = lmService.model ?? 'unknown';

  if (!lmStats) {
    return `\n--- LM Statistics ---\nProvider: ${provider}\nModel:    ${model}\n(no stats available)`;
  }

  return [
    '\n--- LM Statistics ---',
    `Provider: ${provider}`,
    `Model:    ${model}`,
    `Total calls: ${lmStats.totalCalls}`,
    `Successful:  ${lmStats.successfulCalls}`,
    `Failed:      ${lmStats.failedCalls}`,
    `Avg duration: ${formatDuration(lmStats.averageDuration)}`,
  ].join('\n');
}

export function formatNARStats(nar: NAR): string {
  const stats = nar.getStatistics();
  return [
    '\n--- NAR Statistics ---',
    `Concepts: ${stats.totalConcepts}`,
    `Tasks: ${stats.totalTasks}`,
  ].join('\n');
}

export function formatCombinedStats(nar: NAR, lmService: LMHandle): string {
  return `${formatNARStats(nar)}${formatLMExecutionStats(lmService)}`;
}

export function formatBeliefs(nar: NAR, limit = 20): string {
  const beliefs = nar.getBeliefs();
  const lines = [
    `\n--- ${beliefs.length} Belief(s) ---`,
    ...limitList(
      beliefs,
      limit,
      (b) => {
        const termStr = b.term?.toString?.() ?? String(b.term);
        const truth = b.truth ? ` ${formatTruth(b.truth)}` : '';
        return `  ${termStr}${truth}`;
      },
      'more'
    ),
  ];
  return lines.join('\n');
}

export function formatConcepts(nar: NAR, limit = 20): string {
  const concepts = nar.listConcepts();
  const lines = [
    `\n--- ${concepts.length} Concept(s) ---`,
    ...limitList(concepts, limit, (c) => `  ${c.term}: priority=${c.priority.toFixed(2)}`, 'more'),
  ];
  return lines.join('\n');
}

export function formatAttention(nar: NAR, limit = 20): string {
  const attn = nar.attentionReport();
  const lines = [
    `\n--- Attention (${attn.total} total) ---`,
    ...limitList(attn.concepts, limit, (c) => `  ${c.term} (p=${c.priority.toFixed(2)})`, 'more'),
  ];
  return lines.join('\n');
}

export function formatAgentStatus(agent: Agent, nar: NAR, lmService: LMHandle): string {
  const stats = nar.getStatistics();
  const lmStats = lmService.getStats();
  const knowledge = agent.knowList();
  const lines = [
    '\n--- Agent Status ---',
    `Throttle: ${agent.getThrottle()}%`,
    '\n--- NAR ---',
    `Concepts: ${stats.totalConcepts}`,
    `Tasks: ${stats.totalTasks}`,
    '\n--- LM ---',
    `Provider: ${lmService.provider ?? 'unknown'}`,
    `Model: ${lmService.model ?? 'unknown'}`,
  ];
  if (lmStats) {
    lines.push(
      `Calls: ${lmStats.totalCalls} (${lmStats.successfulCalls} ok, ${lmStats.failedCalls} fail)`
    );
    lines.push(`Avg: ${formatDuration(lmStats.averageDuration)}`);
  }
  lines.push('\n--- Knowledge ---', `${knowledge.length} entries`);
  return lines.join('\n');
}
