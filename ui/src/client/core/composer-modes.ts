/**
 * Composer modes (§8.1, Phase 1.2). The composer is one universal input; a mode
 * is a declared intent that shapes the placeholder and the extracted structure,
 * and — once `reasoning`/`tools` land — the path the text takes. Modes are data
 * gated by capabilities, so an intent the composition cannot honour is hidden
 * rather than offered as a silent no-op.
 *
 * The catalog is the SSOT (D7): `ComposerMode` derives from the keys of
 * `COMPOSER_MODE_DEFS`, so adding a mode is one entry and no hand tuple to edit.
 *
 * Now implemented as a Facet catalog (P4 unification).
 */

import type { Capability } from './capabilities.js';
import { decomposeInput, type InputSegment } from './input-decomposition.js';
import { defineCatalog } from '../framework/catalog.js';
import { defineFacetCatalog, createModeFacet, type FacetDescriptor } from '../framework/facet.js';

/** Internal facet catalog for composer modes — uses the unified Facet system (P4). */
const COMPOSER_MODE_FACET_DEFS = defineFacetCatalog({
  ask: createModeFacet('ask', 'Ask', {
    capability: 'language',
    hint: 'Ask SeNARS…',
    structured: false,
  }),
  reply: createModeFacet('reply', 'Reply', {
    capability: 'language',
    hint: 'Continue the conversation…',
    structured: false,
  }),
  question: createModeFacet('question', 'Question', {
    capability: 'language',
    hint: 'Pose a question…',
    structured: false,
  }),
  command: createModeFacet('command', 'Command', {
    capability: 'language',
    hint: '/command …',
    structured: false,
  }),
  explain: createModeFacet('explain', 'Explain', {
    capability: 'language',
    hint: 'Ask for an explanation…',
    structured: false,
  }),
  demonstrate: createModeFacet('demonstrate', 'Demonstrate', {
    capability: 'language',
    hint: 'Show the work in the workspace…',
    structured: false,
  }),
  transform: createModeFacet('transform', 'Transform', {
    capability: 'language',
    hint: 'Transform the selected content…',
    structured: false,
  }),
  believe: createModeFacet('believe', 'Believe', {
    capability: 'reasoning',
    hint: 'Admit a belief…',
    structured: true,
  }),
  goal: createModeFacet('goal', 'Goal', {
    capability: 'reasoning',
    hint: 'Set a goal…',
    structured: true,
  }),
  tool: createModeFacet('tool', 'Tool', {
    capability: 'tools',
    hint: 'Invoke a tool…',
    structured: true,
  }),
} as const);

/** The flat composer mode entry type (back-compat). */
export interface ComposerModeEntry extends Record<string, unknown> {
  readonly label: string;
  readonly id: string;
  readonly capability: Capability;
  readonly hint: string;
  readonly structured: boolean;
}

/** Back-compat: the flat composer mode catalog for existing consumers. */
export const COMPOSER_MODE_DEFS = (() => {
  const def: Record<string, ComposerModeEntry> = {};
  for (const id of COMPOSER_MODE_FACET_DEFS.ids) {
    const f = COMPOSER_MODE_FACET_DEFS.get(id);
    def[id] = {
      label: f.label,
      id: f.id,
      capability: f.data.capability as Capability,
      hint: f.data.hint as string,
      structured: f.data.structured as boolean,
    };
  }
  return defineCatalog(def);
})();

/** The facet catalog for composer modes (P4 unification). */
export const COMPOSER_MODE_FACETS = COMPOSER_MODE_FACET_DEFS;

/** The semantic id of a composer mode facet — the catalog keys are its source (P4). */
export type ComposerModeFacetId = keyof typeof COMPOSER_MODE_FACET_DEFS.definition;

/** The composer mode facet entry type. */
export type ComposerModeFacetEntry = typeof COMPOSER_MODE_FACET_DEFS.definition[ComposerModeFacetId];

/** The semantic id of a composer mode — the catalog keys are its source (D7). */
export type ComposerMode = keyof typeof COMPOSER_MODE_DEFS.definition;

/** Every mode id, in catalog order. */
export const COMPOSER_MODE_IDS = COMPOSER_MODE_DEFS.ids;

export const composerModeDef = (id: ComposerMode): ComposerModeEntry => COMPOSER_MODE_DEFS.get(id)!;

/** The mode ids a facet selects, in catalog order — the one way a partial set is read. */
export const composerModeIdsWhere = (facet: (def: ComposerModeEntry) => boolean): ComposerMode[] =>
  COMPOSER_MODE_DEFS.where(facet);

/** Every mode as a descriptor array. */
export const composerModes = (): ComposerModeEntry[] =>
  COMPOSER_MODE_IDS.map((id) => COMPOSER_MODE_DEFS.get(id)!);

/** Modes available under the given capabilities. */
export const availableComposerModes = (
  capabilities: ReadonlySet<Capability>
): ComposerModeEntry[] => composerModes().filter((mode) => capabilities.has(mode.capability));

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
export const COMPOSER_MODE_CATALOG = COMPOSER_MODE_DEFS.definition;