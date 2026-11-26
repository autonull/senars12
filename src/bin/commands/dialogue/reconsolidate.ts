/** Ingest retrospective lessons as self-beliefs */

import { cmd } from '@senars/cli';
import { SenarsError } from '@senars/errors';
import { errMsg } from '@senars/util/error';
import type { BotRuntime } from '../context';

export const reconsolidateCommand = cmd(
  'reconsolidate',
  'Ingest retrospective lessons as self-beliefs (one-shot per digest, survives restarts)',
  (rt: BotRuntime) => async () => {
    const { Reconsolidator, loadRetrospectives } = await import('../../dialogue/index');
    const reconsolidator = new Reconsolidator(
      { load: (n: number) => loadRetrospectives(n) },
      {
        input: (term, frequency, confidence) =>
          rt.wired.nar
            .input(`<${term}>.`, 'belief', { f: frequency, c: confidence } as never)
            .then(() => {}),
      },
      { term: 'dialogue_performance', truth: { frequency: 0.9, confidence: 0.6 } }
    );
    const { ingested, skipped } = await reconsolidator.reconsolidate(50).catch((e: unknown) => {
      throw new SenarsError(`Reconsolidation failed (fail-closed): ${errMsg(e)}`, 'OPERATION_ERROR', { cause: errMsg(e) });
    });
    return `Reconsolidated: ingested=${ingested} already-done=${skipped}`;
  }
);