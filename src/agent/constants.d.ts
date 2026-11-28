import type { ConnectionState } from '../util';
/** Hex color codes for each cognitive lens. */
export declare const LENS_COLORS_HEX: Record<string, string>;
/** Human-readable labels for each cognitive lens. */
export declare const LENS_LABELS: Record<string, string>;
/** Short descriptions for each cognitive lens shown in the UI. */
export declare const LENS_DESCRIPTIONS: Record<string, string>;
/**
 * Color coding for connection states.
 *
 * Keyed by {@link ConnectionState} rather than by `string`, so a colour cannot be
 * declared for a state the transport layer cannot reach — which is how a
 * `reconnecting` swatch survived alongside no such state while `idle`,
 * `disconnecting` and `error` had none.
 */
export declare const CONNECTION_COLORS: Record<ConnectionState, string>;
/** NAR-native edge types and their UI labels. */
export declare const EDGE_TYPES: Record<string, string>;
/** Human-readable labels for edge types (aliased from EDGE_TYPES for convenience). */
export declare const EDGE_LABELS: Record<string, string>;
/** Returns the UI label for an edge type, falling back to the raw type string. */
export declare function edgeTypeLabel(type: string): string;
/** Lens field descriptor for dynamic field discovery. */
export interface LensFieldDescriptor {
    key: string;
    label: string;
    type: 'number' | 'boolean' | 'string' | 'object';
}
/** Available fields for lens mapping, shared between server schema and designer. */
export declare const LENS_FIELDS: LensFieldDescriptor[];
/**
 * The deadlines the motor and the gates charge against.
 *
 * Five sites wrote these ceilings as literals, and the two values each had more
 * than one copy: the approval wait appeared once in the zod schema, once in the
 * JSON Schema beside it, and once at the call that applies it; the shell deadline
 * appeared in the executor and again in the `tool.request` payload that reported
 * it. Lengthening one copy left the others charging a different ceiling on the
 * same call.
 */
export declare const APPROVAL_TIMEOUT_MS = 60000;
export declare const SHELL_TIMEOUT_MS = 30000;
export declare const WEB_FETCH_TIMEOUT_MS = 15000;
//# sourceMappingURL=constants.d.ts.map