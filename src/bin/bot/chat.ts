/**
 * Chat collection logic for the bot.
 */

import type { BotRuntime } from './runtime';
import type { LMTask } from '@senars/types/llm';
import { createLogger, type Logger } from '@senars/util/logger';
import { setupGracefulShutdown } from '@senars/util/shutdown';
import { narrationKeys } from './runtime';
import { captureDistillation } from './runtime';
import { makeId } from '@senars/util/id';

const logger = createLogger({ scope: 'bot-chat' });

/** Collect chat from agent and stream to stdout. */
export async function collectChat(rt: BotRuntime, input: string, tier: LMTask): Promise<void> {
  const { agent } = rt.wired;
  const { ground, trace } = rt;
  const ctl = new AbortController();
  const onSigint = () => ctl.abort();
  process.once('SIGINT', onSigint);

  try {
    let response = '';
    const reputationKeys = narrationKeys();

    for await (const evt of agent.chat(input, { signal: ctl.signal, tier } as never)) {
      if (evt.kind === 'text-delta' && evt.text) {
        response += evt.text;
        if (ground.enabled && ground.gate) {
          const ok = await ground.gate(evt.text, reputationKeys);
          process.stdout.write(ok ? evt.text : '[filtered]');
        } else {
          process.stdout.write(evt.text);
        }
      } else if (evt.kind === 'tool-call') {
        process.stdout.write(`\n[tool:${evt.toolName}]\n`);
      } else if (evt.kind === 'error' || evt.kind === 'aborted') {
        break;
      }
    }

    // Dialogue capture via macro pipeline (REFACTOR.todo1 Phase A)
    // Trace grading for distillation (opt-in)
    if (trace.enabled && trace.grader && Math.random() < trace.sampleRate) {
      try {
        const grade = await trace.grader({
          correlationId: makeId(),
          narration: response || input,
          toolCalls: [],
        });
        const abstained = grade.groundedness?.abstained ?? false;
        const score = abstained ? grade.contrastiveQuality : grade.groundedness?.score;
        if (score !== undefined && score >= 0.7) {
          await captureDistillation(trace, input, response, score, abstained ? 'ood' : 'in-domain');
        }
      } catch {
        // Ignore trace grading errors
      }
    }
  } finally {
    process.removeListener('SIGINT', onSigint);
    process.stdout.write('\n');
  }
}