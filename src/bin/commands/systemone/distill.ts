/** Distillation dataset status */

import { existsSync, statSync } from 'node:fs';
import { formatBytes } from '@senars/util/format';
import { cmd } from '../cli';
import { datasetPathOf } from './constants';
import type { BotRuntime } from '../context';

export const distillCommand = cmd(
  'distill',
  'Distillation dataset status',
  (rt: BotRuntime) => () => {
    const p = datasetPathOf(rt);
    const st = existsSync(p) ? formatBytes(statSync(p).size) : 'absent';
    return `dataset ${p}: ${st}\nRun full teacher→student loop: pnpm run demo:arcade -- --distill`;
  }
);