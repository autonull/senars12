/**
 * Logic — a three-valued verdict and the five logic commands.
 *
 * One proof surface: `prove`, `model`, `counterexample`, `check`, `convert`.
 * The verdict is deliberately three-valued — `proved`, `refuted`, `unknown` —
 * because an incompleteness result is a fact, not a failure to launder.
 */

import type { ProofCertificate, Model } from '../logics/axiomatic/ast.js';

/** The three-valued logic verdict. Incompleteness is typed, never laundered. */
export type Verdict =
  | { readonly status: 'proved'; readonly certificate: ProofCertificate }
  | { readonly status: 'refuted'; readonly countermodel: Model }
  | { readonly status: 'unknown'; readonly reason: string };

/** A single logic command's result, safe to serialise. */
export interface CommandResult {
  readonly command: 'prove' | 'model' | 'counterexample' | 'check' | 'convert';
  readonly verdict?: Verdict;
  readonly output?: string;
  readonly ok: boolean;
}

export const proved = (certificate: ProofCertificate): Verdict => ({ status: 'proved', certificate });
export const refuted = (countermodel: Model): Verdict => ({ status: 'refuted', countermodel });
export const unknown = (reason: string): Verdict => ({ status: 'unknown', reason });

/** The verdict status as a value, for readers that must enumerate it. */
export const VERDICT_STATUSES = ['proved', 'refuted', 'unknown'] as const;
export type VerdictStatus = (typeof VERDICT_STATUSES)[number];
