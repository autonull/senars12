/**
 * Cycle-path ports: capabilities the core *needs*, named without naming who
 * provides them.
 *
 * A port here is an interface the core declares and the composition root
 * satisfies. It exists so that a core-side module can name what it needs without
 * importing the induction layer to learn the name — the boundary TODO29.a §5.2
 * turns from a lint rule into a structural fact.
 */

import type { LMGenerateOptions } from '@senars/util';

/** The per-call option bag, in core vocabulary. */
export type TextGenerationOptions = LMGenerateOptions;

/**
 * Generate text from a prompt. The narrowest provider capability the cycle path
 * needs, and deliberately narrower than the layer's `LMService`: a caller that
 * wants structured output, a routing chain or a usage ledger is not on the cycle
 * path, and a port that grows those members grows the boundary with it.
 *
 * Structurally satisfied by `LMService` — extra members are fine, extra
 * *required* parameters are not, so a provider cannot demand an argument the
 * core has no vocabulary for.
 */
export interface TextGenerator {
  generateText(prompt: string, opts?: TextGenerationOptions): Promise<string>;
}