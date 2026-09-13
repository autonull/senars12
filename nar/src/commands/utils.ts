import type { CommandContext } from '@senars/core/command-types';
import type { NAR } from '../nar.js';

export interface NarCommandContext extends CommandContext {
  readonly nar?: NAR;
}

export const requireNar = (
  ctx: NarCommandContext
): { ok: true; nar: NonNullable<NAR> } | { ok: false; message: string } =>
  ctx.nar ? { ok: true, nar: ctx.nar } : { ok: false, message: 'NAR not configured' };
