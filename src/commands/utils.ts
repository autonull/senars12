import type { CommandContext, CommandHandler } from '@senars/util';
import type { NAR } from '../nar.js';

export interface NarCommandContext extends CommandContext {
  readonly nar?: NAR;
}

/** Typed view of the NAR handle carried on the command context. */
export const narOf = (ctx: CommandContext): NAR | undefined => (ctx as NarCommandContext).nar;

/**
 * A command that cannot run without a subsystem, bound to its absence.
 *
 * Twenty-four commands across eight files each opened with the same two lines —
 * resolve a handle off the context, `if (!handle) return '<thing> not
 * configured'` — and carried three different vocabularies for that one shape
 * (`NAR not configured`, `Episodic memory not configured`, `Self-reasoning not
 * configured`). So which message a user saw depended on which file declared the
 * command rather than on which subsystem was missing, and the guard itself was
 * twenty-four chances to be written slightly differently.
 *
 * The subsystem becomes a parameter and the sentence one: `requiring('NAR',
 * narOf, …)`. That is also where the not-configured message now lives, which is
 * why the `NAR_UNCONFIGURED` constant this replaced had no callers left — two
 * sources for one sentence is the drift this exists to remove.
 */
export const requiring =
  <T>(
    label: string,
    resolve: (ctx: CommandContext) => T | undefined,
    run: (target: T, args: string[], ctx: CommandContext) => string | Promise<string>
  ): CommandHandler =>
  async (args, ctx) => {
    const target = resolve(ctx);
    return target === undefined ? `${label} not configured` : run(target, args, ctx);
  };
