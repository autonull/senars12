import type { ConnectionManager } from '../connection-manager.js';
import type { Connection } from '../types.js';

/**
 * @deprecated Will be removed in next major version.
 * Use `import { CommandRegistry, type CommandHandler, type CommandDefinition } from '@senars/util'` instead.
 * io-specific CommandContext with ConnectionManager kept locally for type safety.
 */
export { CommandRegistry } from '@senars/util';
export type { CommandHandler, CommandDefinition } from '@senars/util';

export interface CommandContext {
  readonly connection: Connection;
  readonly manager?: ConnectionManager;
}
