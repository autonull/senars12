/**
 * Command registry — back-compat re-exports from the unified Intent catalog.
 *
 * The command registry is now backed by the Intent catalog. New code should import
 * `dispatch` from `./intent-registry.js` instead of `dispatchCommand`.
 */
import { recordCommandUse } from './command-history.js';
import { validateCommandArgs } from './command-schemas.js';
import { getIntentCatalog, dispatch, type IntentDescriptor } from './intent-registry.js';

/** Command args are always an object. */
export type CommandArgs = Record<string, unknown>;

/** Back-compat Command interface. */
export interface Command {
  readonly id: string;
  readonly title: string;
  readonly group: string;
  /** Extra search terms (never shown). */
  readonly keywords?: string;
  run(args: CommandArgs): void;
  /** Validate/coerce the caller's args (agent `ui.command`); throw to reject. */
  parse?(args: CommandArgs): CommandArgs;
  /** A command that only makes sense in some state can hide itself. */
  available?(): boolean;
  /** Keep the command dispatchable but out of the palette list (e.g. the palette itself). */
  readonly paletteHidden?: boolean;
}

/** All commands from the intent catalog (kind === 'command'). */
export const registeredCommands = (): Command[] =>
  getIntentCatalog()
    .allIntents()
    .filter((i) => i.kind === 'command') as Command[];

/** Commands the palette lists (drops those that hide themselves from it). */
export const paletteCommands = (): Command[] =>
  getIntentCatalog()
    .paletteIntents()
    .filter((i) => i.kind === 'command') as Command[];

/** Every command the palette may offer right now. */
export const activeCommands = (): Command[] =>
  getIntentCatalog()
    .allIntents()
    .filter((i) => i.kind === 'command' && i.available?.() !== false) as Command[];

/**
 * Run a command by id, respecting availability, and report whether it ran.
 * This is the seam the agent `ui.command` (§3.6) and any programmatic caller use,
 * so every palette command is agent-settable without a second registry.
 * A command may declare `parse` to validate/coerce args; a rejection is reported, not thrown.
 * Zod schemas from `command-schemas.ts` provide type-safe validation for agent calls.
 */
export const dispatchCommand = (id: string, args: CommandArgs = {}): boolean => {
  const command = activeCommands().find((candidate) => candidate.id === id);
  if (!command) return false;

  // First validate with Zod schema (for agent calls)
  const validation = validateCommandArgs(id, args);
  if (!validation.success) {
    console.warn(`[command] ${id} rejected: ${validation.error}`);
    return false;
  }

  try {
    const parsedArgs = (validation.data ?? args) as CommandArgs;
    command.run(command.parse ? command.parse(parsedArgs) : parsedArgs);
  } catch (error) {
    console.warn(`[command] ${id} rejected its args`, error);
    return false;
  }
  recordCommandUse(id);
  return true;
}

/**
 * @deprecated Use intent-registry.ts to define intents instead.
 * This function exists only for back-compat during migration.
 */
export const registerCommand = (_command: Command): void => {
  console.warn('[command] registerCommand is deprecated; define intents in intent-registry.ts instead');
};

// Re-export the unified dispatch for new code
export { dispatch } from './intent-registry.js';

// Re-export IntentDescriptor for back-compat
export type { IntentDescriptor } from './intent-registry.js';