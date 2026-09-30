/**
 * The MeTTa seam.
 *
 * `metta` sits above `nar` in the layering, so `nar` may not import it — the
 * MeTTa engine is injected rather than constructed. This interface is the whole
 * of what `nar` needs, declared here because `core` is the one package both
 * sides already depend on: `metta` implements it, `nar` consumes it, and the
 * composition root chooses whether to wire the real one.
 *
 * Absent a port is the honest state, not a degraded one: the `metta` tool
 * reports `metta engine not configured` and command parsing is skipped, which
 * is what the runtime already did for an unconfigured engine.
 */
import type { ParsedCommand } from './agent/types.js';

export interface MettaPort {
  /** Parse LLM-authored output into executable commands. */
  parseCommands(text: string): ParsedCommand[];

  /** Evaluate one MeTTa expression; returns the results, empty on any fault. */
  query(expression: string): Promise<unknown[]>;

  /**
   * Load a program into the engine, resolving with the accepted source and
   * rejecting when it does not load. A program that loads is the engine's
   * statement that it is well-formed — the text is the confirmation.
   */
  loadProgram(program: string): Promise<string>;
}
