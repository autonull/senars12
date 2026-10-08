/**
 * Deterministic input decomposition (§8.2, Phase 1.3). User input is not one raw
 * blob: it splits into ordered `claim` / `question` / `command` segments so both
 * Notebook and Graph gain structure immediately. Purely lexical — no LM, no
 * guessing — and the caller keeps the raw text, so fidelity never depends on the
 * split. With `reasoning` on these segments can later formalize; language-only
 * they are conversational content.
 */

import type { BlockKind } from './workspace-graph.js';

export type InputKind = Extract<BlockKind, 'claim' | 'question' | 'command'>;

export interface InputSegment {
  readonly kind: InputKind;
  readonly text: string;
}

const INTERROGATIVE =
  /^(what|why|how|when|where|who|whom|whose|which|is|are|was|were|do|does|did|can|could|should|would|will|may|might)\b/i;

const isQuestion = (sentence: string): boolean =>
  sentence.endsWith('?') || INTERROGATIVE.test(sentence);

/** Split text into sentences, keeping each verbatim (internal whitespace intact). */
const sentences = (text: string): string[] =>
  (text.match(/[^.!?]+[.!?]*/g) ?? []).map((sentence) => sentence.trim()).filter(Boolean);

/** Decompose raw input into ordered semantic segments; a slash line is one command. */
export function decomposeInput(text: string): InputSegment[] {
  const trimmed = text.trim();
  if (trimmed === '') return [];
  if (trimmed.startsWith('/')) return [{ kind: 'command', text: trimmed }];
  return sentences(trimmed).map((sentence) => ({
    kind: isQuestion(sentence) ? 'question' : 'claim',
    text: sentence,
  }));
}

/**
 * Whether the segments reconstruct the raw input exactly. When false the caller
 * must keep the raw text alongside the segments (they lost separators/whitespace).
 */
export function isFaithfulDecomposition(raw: string, segments: readonly InputSegment[]): boolean {
  return (
    segments.length === 1 && segments[0]?.kind === 'claim' && segments[0].text === raw
  );
}
