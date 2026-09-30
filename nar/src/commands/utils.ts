import type { CommandContext } from '@senars/util';
import type { NAR } from '../nar.js';

export const NAR_UNCONFIGURED = 'NAR not configured';

export interface NarCommandContext extends CommandContext {
  readonly nar?: NAR;
}

/** Typed view of the NAR handle carried on the command context. */
export const narOf = (ctx: CommandContext): NAR | undefined => (ctx as NarCommandContext).nar;
