/** Distillation dataset status */

import { cmd } from '@senars/cli';
import { datasetPathOf } from './constants';
import type { BotRuntime } from '../context';
import { fileInfo, formatBytes } from '@senars/bin/lib/diagnostics';

export const distillCommand = cmd(
  'distill',
  'Distillation dataset status',
  (rt: BotRuntime) => () => {
    const p = datasetPathOf(rt);
    const info = fileInfo(p);
    const st = info.exists ? formatBytes(info.bytes) : 'absent';
    return `dataset ${p}: ${st}\nRun full teacher→student loop: pnpm run demo:arcade -- --distill`;
  }
);