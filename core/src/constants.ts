/** Hex color codes for each cognitive lens. */
export const LENS_COLORS_HEX: Record<string, string> = {
  belief: '#00f3ff',
  goal: '#ff00aa',
  contradiction: '#ffaa00',
};

/** Human-readable labels for each cognitive lens. */
export const LENS_LABELS: Record<string, string> = {
  belief: 'Beliefs',
  goal: 'Goals',
  contradiction: 'Conflicts',
};

/** Color coding for WebSocket connection states. */
export const CONNECTION_COLORS: Record<string, string> = {
  connected: '#00cc88',
  connecting: '#00aaff',
  reconnecting: '#ffaa00',
  disconnected: '#ff4444',
};

/** Short descriptions for each cognitive lens shown in the UI. */
export const LENS_DESCRIPTIONS: Record<string, string> = {
  belief: 'What the system knows',
  goal: 'What the system wants',
  contradiction: 'Where beliefs conflict',
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