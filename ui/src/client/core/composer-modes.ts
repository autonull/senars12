/**
 * Composer modes (§8.1, Phase 1.2). The composer is one universal input; a mode
 * is a declared intent that shapes the placeholder and the extracted structure,
 * and — once `reasoning`/`tools` land — the path the text takes. Modes are data
 * gated by capabilities, so an intent the composition cannot honour is hidden
 * rather than offered as a silent no-op.
 */

import type { Capability } from './capabilities.js';
import { decomposeInput, type InputSegment } from './input-decomposition.js';

export const COMPOSER_MODE_IDS = [
  'ask',
  'reply',
  'question',
  'command',
  'explain',
  'demonstrate',
  'transform',
  'believe',
  'goal',
  'tool',
] as const;

export type ComposerMode = (typeof COMPOSER_MODE_IDS)[number];

export interface ComposerModeDescriptor {
  readonly id: ComposerMode;
  /** The capability that makes the mode do real work. */
  readonly capability: Capability;
  readonly label: string;
  readonly hint: string;
  /** A structured mode is a formalization seam, not yet an NL request. */
  readonly structured: boolean;
}

export const COMPOSER_MODE_CATALOG = {
  ask: { id: 'ask', capability: 'language', label: 'Ask', hint: 'Ask SeNARS…', structured: false },
  reply: { id: 'reply', capability: 'language', label: 'Reply', hint: 'Continue the conversation…', structured: false },
  question: { id: 'question', capability: 'language', label: 'Question', hint: 'Pose a question…', structured: false },
  command: { id: 'command', capability: 'language', label: 'Command', hint: '/command …', structured: false },
  explain: { id: 'explain', capability: 'language', label: 'Explain', hint: 'Ask for an explanation…', structured: false },
  demonstrate: { id: 'demonstrate', capability: 'language', label: 'Demonstrate', hint: 'Show the work in the workspace…', structured: false },
  transform: { id: 'transform', capability: 'language', label: 'Transform', hint: 'Transform the selected content…', structured: false },
  believe: { id: 'believe', capability: 'reasoning', label: 'Believe', hint: 'Admit a belief…', structured: true },
  goal: { id: 'goal', capability: 'reasoning', label: 'Goal', hint: 'Set a goal…', structured: true },
  tool: { id: 'tool', capability: 'tools', label: 'Tool', hint: 'Invoke a tool…', structured: true },
} as const satisfies Record<ComposerMode, ComposerModeDescriptor>;

export const composerModes = (): ComposerModeDescriptor[] =>
  COMPOSER_MODE_IDS.map((id) => COMPOSER_MODE_CATALOG[id]);

export const availableComposerModes = (
  capabilities: ReadonlySet<Capability>
): ComposerModeDescriptor[] => composerModes().filter((mode) => capabilities.has(mode.capability));

/** The mode the composer starts in; available in every composition with `language`. */
export const DEFAULT_COMPOSER_MODE: ComposerMode = 'ask';

/** Narrow a carried/wire mode string (the protocol keeps it free-form). */
export const isComposerMode = (value: string | undefined): value is ComposerMode =>
  value !== undefined && (COMPOSER_MODE_IDS as readonly string[]).includes(value);

/**
 * Decompose input under a declared mode. `question` imposes the question kind on
 * every segment, `command` makes the whole input one command; the remaining
 * language modes use the deterministic lexical split (§8.2). Structured modes
 * fall back to the lexical split until their producer exists.
 */
export function decomposeForMode(text: string, mode: ComposerMode): InputSegment[] {
  if (mode === 'command') {
    const trimmed = text.trim();
    return trimmed === '' ? [] : [{ kind: 'command', text: trimmed }];
  }
  const segments = decomposeInput(text);
  return mode === 'question'
    ? segments.map((segment) => ({ kind: 'question', text: segment.text }) satisfies InputSegment)
    : segments;
}
