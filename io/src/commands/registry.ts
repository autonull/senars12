/**
 * Command registry surface for `io`. `CommandRegistry` and the command
 * vocabulary are declared once in `@senars/util`; `io` used to carry a
 * narrowed `CommandContext` copy that dropped the `nar` handle the `nar/*`
 * command groups need.
 */
export {
  type CommandContext,
  type CommandDefinition,
  type CommandHandler,
  CommandRegistry,
} from '@senars/util';
