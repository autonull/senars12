/**
 * `ui.command` — the agent-operable workspace command (§3.6, carried contract for
 * Phase 5). The schema is the contract; the client dispatches `command` against
 * the same registry the palette reads, so every command is agent-settable for
 * free. `args` is reserved until a command declares a parameter schema.
 */
import { z } from 'zod';
export declare const UiCommandMsg: z.ZodObject<{
    command: z.ZodString;
    args: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    type: z.ZodLiteral<"ui.command">;
}, z.core.$strip>;
//# sourceMappingURL=ui-command.d.ts.map