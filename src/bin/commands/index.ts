/**
 * Bot command surface — the `.command` groups behind `senars>`.
 *
 * Order matters only for name collisions: a later group wins because the CLI
 * connection indexes commands into a map. `.recall` is intentionally the
 * cross-memory variant here rather than the session-scoped one in `buildCommands`.
 */

import type { CLICommand } from '@senars/io';
import { configCommandsFor } from './config';
import { connectionCommandsFor } from './connection';
import type { BotRuntime } from './context';
import { diagnosticCommandsFor } from './diagnostics';
import { dialogueCommandsFor } from './dialogue';
import { lmCommandsFor } from './lm';
import { memoryCommandsFor } from './memory';
import { profileCommandsFor } from './profile';
import { runtimeCommandsFor } from './runtime';
import { systemOneCommandsFor } from './systemone';

export type {
  BotRuntime,
  ConnectSpec,
  GroundednessState,
  SystemOneBag,
  TraceState,
} from './context';
export { systemOneOf } from './context';
export { runSessionRetrospective } from './dialogue';
export { gpuSummary } from './lm';

/** Every local-connection command, grouped by subsystem. */
export const buildBotCommands = (rt: BotRuntime): CLICommand[] => [
  ...connectionCommandsFor(rt),
  ...profileCommandsFor(rt),
  ...memoryCommandsFor(rt),
  ...lmCommandsFor(rt),
  ...dialogueCommandsFor(rt),
  ...systemOneCommandsFor(rt),
  ...diagnosticCommandsFor(rt),
  ...runtimeCommandsFor(rt),
  ...configCommandsFor(rt),
];
