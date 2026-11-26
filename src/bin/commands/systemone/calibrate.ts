/** Calibration lock status: .calibrate [refresh|refit] */

import { existsSync, statSync } from 'node:fs';
import { formatBytes } from '@senars/util/format';
import { attempted, cmd } from '@senars/cli';
import { datasetPathOf } from './constants';
import type { BotRuntime } from '../context';

export const calibrateCommand = cmd(
  'calibrate',
  'Calibration lock status: .calibrate [refresh|refit]',
  (rt: BotRuntime) => async (args = '') => {
    const {
      CALIBRATION_LOCK_PATH,
      readCalibrationLockOrNull,
      writeCalibrationLock,
      fitCalibrationLock,
    } = await import('@senars/lm/system-one');
    const verb = args.trim().toLowerCase();
    if (verb === 'refresh') {
      if (!rt.wired.nar.isSystemOneEnabled?.()) return 'System One: disabled';
      await rt.wired.nar.refreshSystemOneContrastive(rt.wired.episodicMemory);
      const stats = rt.wired.nar.getSystemOneContrastive?.()?.stats() ?? {};
      const totals = Object.values(stats).reduce(
        (a, s) => ({ p: a.p + s.positives, n: a.n + s.negatives }),
        { p: 0, n: 0 }
      );
      return `Contrastive exemplars refreshed: ${totals.p}P/${totals.n}N across ${Object.keys(stats).length} rubric(s)`;
    }
    if (verb === 'refit') {
      if (!rt.wired.nar.isSystemOneEnabled?.()) return 'System One: disabled';
      return attempted('refit', async () => {
        const { JudgmentDataset, digestRows, loadEvalSet, splitOod } = await import('@senars/lm/system-one');
        const dataset = await JudgmentDataset.load(datasetPathOf(rt));
        let options: Record<string, unknown> = {};
        try {
          const frozen = await loadEvalSet(EVAL_SET_PATH);
          const { inDomain, ood } = splitOod(frozen.rows);
          options = {
            frozenSet: {
              digest: inDomain.length > 0 ? digestRows(inDomain) : frozen.digest,
              rows: inDomain,
            },
            ...(ood.length > 0 ? { oodSet: { digest: digestRows(ood), rows: ood } } : {}),
          };
        } catch {
          // No frozen set — per-run holdout only.
        }
        const { lock, perHead, improved } = fitCalibrationLock(dataset, options as never);
        await writeCalibrationLock(lock, CALIBRATION_LOCK_PATH);
        return `Calibration lock refit: ${perHead.size} head(s), holdout ECE improved=${improved}, frozen-set metrics=${lock.eval ? 'embedded' : 'absent (run .systemone eval-set create)'}\nRestart required to apply the lock to the manifold.`;
      });
    }
    const { EVAL_SET_PATH } = await import('@senars/lm/system-one');
    if (!existsSync(CALIBRATION_LOCK_PATH)) {
      return 'No calibration lock (heads unfitted — pass-through mode)';
    }
    const lock = await readCalibrationLockOrNull();
    if (!lock) return `lock unreadable: ${CALIBRATION_LOCK_PATH}`;
    const heads = lock.heads
      .map((h) => `  ${h.headId}: abstain=${h.fitted ? h.abstainThreshold.toFixed(4) : '—'}`)
      .join('\n');
    return `lock ${formatBytes(statSync(CALIBRATION_LOCK_PATH).size)}\n${heads || '  (no per-head data)'}`;
  }
);