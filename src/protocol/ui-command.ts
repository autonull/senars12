/**
 * `ui.command` — the agent-operable workspace command (§3.6, carried contract for
 * Phase 5). The schema is the contract; the client dispatches `command` against
 * the same registry the palette reads, so every command is agent-settable for
 * free. `args` is reserved until a command declares a parameter schema.
 */

import { z } from 'zod';
import { msg } from './envelope';
import { nonEmpty } from '@senars/util/config';

export const UiCommandMsg = msg('ui.command', {
  command: nonEmpty,
  args: z.record(z.string(), z.unknown()).optional(),
});
