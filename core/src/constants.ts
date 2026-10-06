import { mapValues } from '@senars/util';
import type { ConnectionState } from '@senars/util';
import type { BuiltinLens } from './lens-schema.js';

/**
 * The lens vocabulary: one row per built-in lens, three projections below.
 *
 * The label, the description and the color of a lens were three separate records
 * and the lens itself was a fourth declaration in `lens-schema`, so they drifted:
 * the built-in `temporal` lens had no row here at all and so rendered with no
 * label, and a description could say something the modulation did not do.
 * `Record<BuiltinLens, …>` is what closes the class: a lens added to
 * `BUILTIN_LENS_IDS` without a row here no longer compiles.
 */
const LENS_VOCABULARY = {
  belief: { label: 'Beliefs', description: 'What the system knows', color: '#00f3ff' },
  goal: { label: 'Goals', description: 'What the system wants', color: '#ff00aa' },
  contradiction: { label: 'Conflicts', description: 'Where beliefs conflict', color: '#ffaa00' },
  temporal: {
    label: 'Temporal',
    description: 'What the system saw when',
    color: '#aa88ff',
  },
} as const satisfies Record<BuiltinLens, { label: string; description: string; color: string }>;

/** Hex color codes for each cognitive lens. */
export const LENS_COLORS_HEX: Record<string, string> = mapValues(
  LENS_VOCABULARY,
  (lens) => lens.color
);

/** Human-readable labels for each cognitive lens. */
export const LENS_LABELS: Record<string, string> = mapValues(LENS_VOCABULARY, (lens) => lens.label);

/** Short descriptions for each cognitive lens shown in the UI. */
export const LENS_DESCRIPTIONS: Record<string, string> = mapValues(
  LENS_VOCABULARY,
  (lens) => lens.description
);

/**
 * Color coding for connection states.
 *
 * Keyed by {@link ConnectionState} rather than by `string`, so a colour cannot be
 * declared for a state the transport layer cannot reach — which is how a
 * `reconnecting` swatch survived alongside no such state while `idle`,
 * `disconnecting` and `error` had none.
 */
export const CONNECTION_COLORS: Record<ConnectionState, string> = {
  idle: '#8899aa',
  connecting: '#00aaff',
  connected: '#00cc88',
  disconnecting: '#ffaa00',
  disconnected: '#ff4444',
  error: '#ff4444',
};

/** NAR-native edge types and their UI labels. */
export const EDGE_TYPES: Record<string, string> = {
  inheritance: 'Inheritance',
  similarity: 'Similarity',
  implication: 'Implication',
  equivalence: 'Equivalence',
  derivation: 'Derivation',
  semantic: 'Semantic',
  relation: 'Relation',
};

/** Human-readable labels for edge types (aliased from EDGE_TYPES for convenience). */
export const EDGE_LABELS: Record<string, string> = EDGE_TYPES;

/** Returns the UI label for an edge type, falling back to the raw type string. */
export function edgeTypeLabel(type: string): string {
  return EDGE_TYPES[type] ?? type;
}

/** Lens field descriptor for dynamic field discovery. */
export interface LensFieldDescriptor {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'string' | 'object';
}

/** Available fields for lens mapping, shared between server schema and designer. */
export const LENS_FIELDS: LensFieldDescriptor[] = [
  { key: 'priority', label: 'Priority', type: 'number' },
  { key: 'confidence', label: 'Confidence', type: 'number' },
  { key: 'isContradiction', label: 'Is Contradiction', type: 'boolean' },
  { key: 'truth', label: 'Truth (frequency)', type: 'object' },
  { key: 'occurrenceTime', label: 'Occurrence Time', type: 'number' },
  { key: 'goalRelevance', label: 'Goal Relevance', type: 'number' },
  { key: 'nodeType', label: 'Node Type', type: 'string' },
  { key: 'edgeType', label: 'Edge Type', type: 'string' },
  { key: 'weight', label: 'Edge Weight', type: 'number' },
];
