/**
 * Bot command surface — the `.command` groups behind `senars>`.
 *
 * Order matters only for name collisions: a later group wins because the CLI
 * connection indexes commands into a map. `.recall` is intentionally the
 * cross-memory variant here rather than the session-scoped one in `buildCommands`.
 */

import type { CLICommand } from '@senars/io';
import { configCommandsFor } from './config.js';
import { connectionCommandsFor } from './connection.js';
import type { BotRuntime } from './context.js';
import { diagnosticCommandsFor } from './diagnostics.js';
import { dialogueCommandsFor } from './dialogue.js';
import { lmCommandsFor } from './lm.js';
import { memoryCommandsFor } from './memory.js';
import { profileCommandsFor } from './profile.js';
import { runtimeCommandsFor } from './runtime.js';
import { systemOneCommandsFor } from './systemone.js';

export type {
  BotRuntime,
  ConnectSpec,
  GroundednessState,
  SystemOneBag,
  TraceState,
} from './context.js';
export { systemOneOf } from './context.js';
export { runSessionRetrospective } from './dialogue.js';
export { gpuSummary } from './lm.js';

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
