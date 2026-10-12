/**
 * Composer modes (§8.1, Phase 1.2). The composer is one universal input; a mode
 * is a declared intent that shapes the placeholder and the extracted structure,
 * and — once `reasoning`/`tools` land — the path the text takes. Modes are data
 * gated by capabilities, so an intent the composition cannot honour is hidden
 * rather than offered as a silent no-op.
 *
 * The catalog is the SSOT (D7): `ComposerMode` derives from the keys of
 * `COMPOSER_MODE_DEFS`, so adding a mode is one entry and no hand tuple to edit.
 */

import type { Capability } from './capabilities.js';
import { decomposeInput, type InputSegment } from './input-decomposition.js';

export interface ComposerModeDescriptor {
  /** The mode id (key in the catalog). */
  readonly id: string;
  /** The capability that makes the mode do real work. */
  readonly capability: Capability;
  /** Human label for palette and placeholder. */
  readonly label: string;
  /** Placeholder hint text. */
  readonly hint: string;
  /** A structured mode is a formalization seam, not yet an NL request. */
  readonly structured: boolean;
}

const d = (
  label: string,
  facets: Partial<Omit<ComposerModeDescriptor, 'label' | 'capability'>> & { id: string; capability: Capability }
): ComposerModeDescriptor => ({
  label,
  hint: '',
  structured: false,
  ...facets,
});

export const COMPOSER_MODE_DEFS = {
  ask: d('Ask', { id: 'ask', capability: 'language', hint: 'Ask SeNARS…' }),
  reply: d('Reply', { id: 'reply', capability: 'language', hint: 'Continue the conversation…' }),
  question: d('Question', { id: 'question', capability: 'language', hint: 'Pose a question…' }),
  command: d('Command', { id: 'command', capability: 'language', hint: '/command …' }),
  explain: d('Explain', { id: 'explain', capability: 'language', hint: 'Ask for an explanation…' }),
  demonstrate: d('Demonstrate', { id: 'demonstrate', capability: 'language', hint: 'Show the work in the workspace…' }),
  transform: d('Transform', { id: 'transform', capability: 'language', hint: 'Transform the selected content…' }),
  believe: d('Believe', { id: 'believe', capability: 'reasoning', hint: 'Admit a belief…', structured: true }),
  goal: d('Goal', { id: 'goal', capability: 'reasoning', hint: 'Set a goal…', structured: true }),
  tool: d('Tool', { id: 'tool', capability: 'tools', hint: 'Invoke a tool…', structured: true }),
} as const satisfies Record<string, ComposerModeDescriptor>;

/** The semantic id of a composer mode — the catalog keys are its source (D7). */
export type ComposerMode = keyof typeof COMPOSER_MODE_DEFS;

/** Every mode id, in catalog order. */
export const COMPOSER_MODE_IDS = Object.keys(COMPOSER_MODE_DEFS) as readonly ComposerMode[];

export const composerModeDef = (id: ComposerMode): ComposerModeDescriptor => COMPOSER_MODE_DEFS[id];

/** The mode ids a facet selects, in catalog order — the one way a partial set is read. */
export const composerModeIdsWhere = (facet: (def: ComposerModeDescriptor) => boolean): ComposerMode[] =>
  COMPOSER_MODE_IDS.filter((id) => facet(COMPOSER_MODE_DEFS[id]));

/** Every mode as a descriptor array. */
export const composerModes = (): ComposerModeDescriptor[] =>
  COMPOSER_MODE_IDS.map((id) => COMPOSER_MODE_DEFS[id]);

/** Modes available under the given capabilities. */
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

/** Back-compat alias. */
export const COMPOSER_MODE_CATALOG = COMPOSER_MODE_DEFS;