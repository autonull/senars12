/** Dialogue Flywheel commands barrel. */

import type { BotRuntime } from '../context';
import { reactCommand } from './react';
import { turnsCommand } from './turns';
import { parametersCommand } from './parameters';
import { retrospectCommand } from './retrospect';
import { retrospectivesCommand } from './retrospectives';
import { lessonsCommand } from './lessons';
import { reconsolidateCommand } from './reconsolidate';
import { probesCommand } from './probes';
import { adaptationsCommand } from './adaptations';
import { schemasInduceCommand } from './schemas-induce';

export const dialogueCommandsFor = (rt: BotRuntime) => [
  reactCommand(rt),
  turnsCommand(rt),
  parametersCommand(rt),
  retrospectCommand(rt),
  retrospectivesCommand(rt),
  lessonsCommand(rt),
  reconsolidateCommand(rt),
  probesCommand(rt),
  adaptationsCommand(rt),
  schemasInduceCommand(rt),
];