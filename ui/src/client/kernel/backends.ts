export { narsBackend, NAL_VOCABULARY } from '../core/nars-backend.js';
export { mettaBackend, METTA_VOCABULARY } from '../core/metta-backend.js';
export { awaitControl, settleControl } from '../core/control-channel.js';
export type {
  BackendCaps,
  BackendEdge,
  BackendNode,
  BackendSnapshot,
  BackendVocabulary,
  ControlResult,
  ReasoningBackend,
  ReasoningControl,
  SubmitInput,
} from '../core/reasoning-backend.js';
import type { ReasoningBackend } from '../core/reasoning-backend.js';

/** Registry of reasoning backends. */
const backendRegistry = new Map<string, ReasoningBackend>();

/** Register a reasoning backend. */
export function registerBackend(backend: ReasoningBackend): void {
  if (backendRegistry.has(backend.id)) {
    throw new Error(`Backend with id "${backend.id}" already registered`);
  }
  backendRegistry.set(backend.id, backend);
}

/** Get a backend by id. */
export function backendFor(id: string): ReasoningBackend | undefined {
  return backendRegistry.get(id);
}

/** All registered backends. */
export function getBackends(): readonly ReasoningBackend[] {
  return [...backendRegistry.values()];
}

/** All backend ids. */
export function backendIds(): readonly string[] {
  return [...backendRegistry.keys()];
}

/** Reset backend registry (for testing). */
export function resetBackends(): void {
  backendRegistry.clear();
}