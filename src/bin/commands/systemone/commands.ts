/** System One commands barrel — builds all System One command groups. */

import type { BotRuntime } from '../context';
import { systemoneCommand } from './systemone';
import { judgeCommand } from './judge';
import { decideCommand } from './decide';
import { routeCommand } from './route';
import { cortexCommand } from './cortex';
import { manifoldCommand } from './manifold';
import { calibrateCommand } from './calibrate';
import { distillCommand } from './distill';
import { groundCommand } from './ground';
import { traceCommand } from './trace';
import { reflexCommand } from './reflex';
import { routingAutoCommand } from './routing-auto';
import { provisionalCommand } from './provisional';
import { metaCommand } from './meta';
import { driveCommand } from './drive';
import { s1ConfigCommand } from './s1-config';

export const systemOneCommandsFor = (rt: BotRuntime) => [
  systemoneCommand(rt),
  judgeCommand(rt),
  decideCommand(rt),
  routeCommand(rt),
  cortexCommand(rt),
  manifoldCommand(rt),
  calibrateCommand(rt),
  distillCommand(rt),
  groundCommand(rt),
  traceCommand(rt),
  reflexCommand(rt),
  routingAutoCommand(rt),
  provisionalCommand(rt),
  metaCommand(rt),
  driveCommand(rt),
  s1ConfigCommand(rt),
];