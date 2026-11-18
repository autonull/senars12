import type { CortexSynthesizeRequest, PromptBuilder } from '@senars/core';
import type { LMService } from '../lm/lm-service.js';

export interface CompactionConfig {
  /** Working-memory entries beyond this trigger (re)summarization. */
  summaryThreshold: number;
  /** Recent entries kept verbatim; older ones are folded into the summary. */
  maxHistory: number;
}

const DEFAULTS: CompactionConfig = { summaryThreshold: 30, maxHistory: 20 };

const formatEntry = (e: unknown): string => {
  const rec = e as { type?: string; payload?: unknown };
  const text =
    typeof rec.payload === 'string'
      ? rec.payload
      : rec.payload
        ? JSON.stringify(rec.payload)
        : JSON.stringify(e);
  return rec.type ? `[${rec.type}] ${text}` : text;
};

/**
 * Rolling conversation compaction: entries beyond `maxHistory` are summarized
 * via the LM (fast tier) into a rolling summary injected at the top of the
 * system prompt. Summarization is async and cached — `build()` stays sync and
 * returns the latest available summary.
 */
export const createCompactionPromptBuilder = (
  lm: LMService,
  config?: Partial<CompactionConfig>
): PromptBuilder & { getSummary: () => string } => {
  const { summaryThreshold, maxHistory } = { ...DEFAULTS, ...config };
  let summary = '';
  let inFlight = false;
  let summarizedUpTo = 0;

  return {
    build: (req: CortexSynthesizeRequest & { workingMemory: unknown[] }) => {
      const working = req.workingMemory ?? [];
      const olderCount = working.length - maxHistory;
      if (working.length >= summaryThreshold && !inFlight && olderCount > summarizedUpTo) {
        const older = working.slice(0, working.length - maxHistory);
        if (older.length > 0) {
          summarizedUpTo = olderCount;
          inFlight = true;
          lm.generateText(
            [
              'Summarize the following prior conversation entries into a concise rolling summary.',
              'Preserve pinned facts, decisions, and artifacts. Output only the summary.',
              '',
              ...older.map(formatEntry),
            ].join('\n'),
            { task: 'fast' }
          )
            .then((text) => {
              if (text) summary = text;
            })
            .catch(() => {
              // keep the previous summary on failure; retry on the next call
            })
            .finally(() => {
              inFlight = false;
            });
        }
      }
      return summary ? `Prior conversation summary:\n${summary}` : '';
    },
    getSummary: () => summary,
  };
};
