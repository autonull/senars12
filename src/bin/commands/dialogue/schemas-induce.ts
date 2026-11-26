/** Induce schemas from captured derivation chains (LM-backed) */

import { cmd } from '@senars/cli';
import { SenarsError } from '@senars/errors';
import { errMsg } from '@senars/util/error';
import type { BotRuntime } from '../context';

export const schemasInduceCommand = cmd(
  'schemas-induce',
  'Induce schemas from captured derivation chains (LM-backed)',
  (rt: BotRuntime) => async () => {
    const { nar, lmService } = rt.wired;
    const chains = nar.getDerivationChains(64);
    if (chains.length === 0) {
      return 'No derivation chains captured yet (chains accrue as the kernel reasons).';
    }
    const inductor =
      nar.getSchemaInductor() ??
      new (await import('@senars/learning')).SchemaInductor(nar.memory, lmService, {
        inductionIntervalMs: 0,
      });
    for (const chain of chains) inductor.onDerivation(chain as never);
    const results = await inductor.induceNow({ budget: 8 }).catch((e: unknown) => {
      throw new SenarsError(`Schema induction failed: ${errMsg(e)}`, 'OPERATION_ERROR', { cause: errMsg(e) });
    });
    if (results.length === 0) {
      return `No schemas induced from ${chains.length} chains (below confidence/steps bar).`;
    }
    return results
      .map(
        (r) =>
          `  ${r.schema.template} conf=${r.confidence.toFixed(2)} instances=${r.instances.length}`
      )
      .join('\n');
  }
);