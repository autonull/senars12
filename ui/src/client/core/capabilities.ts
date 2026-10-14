/**
 * The capability registry (§0.3, §3.6; Phase 0.6). Capabilities toggle
 * independently and change what enters the workspace, the default renderer, the
 * composer modes and overlay availability — never which zones exist. The catalog
 * is data, so the composer, commands and future `ui.command` derive availability
 * from one source instead of each hardcoding a feature flag.
 */

import { $activeRenderer, atom, mountTestApi } from './store.js';
import { defineCatalog } from '../framework/catalog.js';

/**
 * The one definition per capability — the id is the catalog key, so the
 * `Capability` union derives from the catalog and adding a capability is one
 * entry.
 */
export const CAPABILITY_DEFS = defineCatalog({
  language: {
    label: 'Language',
    description: 'LM conversation, segmentation and artifacts',
    default: true,
  },
  reasoning: {
    label: 'Reasoning',
    description: 'Beliefs, derivations, gates and provenance',
    default: false,
  },
  tools: {
    label: 'Tools',
    description: 'Tool calls and results',
    default: false,
  },
  memory: {
    label: 'Memory',
    description: 'Persistent sessions',
    default: false,
  },
  uiControl: {
    label: 'UI control',
    description: 'Agent-operable workspace commands',
    default: false,
  },
} as const);

export type Capability = keyof typeof CAPABILITY_DEFS.definition;

export const CAPABILITY_IDS = CAPABILITY_DEFS.ids;

export interface CapabilityDescriptor {
  readonly id: Capability;
  readonly label: string;
  readonly description: string;
  /** Part of the default composition (the LM-only product is `language`). */
  readonly default: boolean;
}

export const capabilityDescriptors = (): CapabilityDescriptor[] =>
  CAPABILITY_DEFS.ids.map((id) => ({ id, ...CAPABILITY_DEFS.get(id) }));

export const defaultCapabilities = (): Set<Capability> =>
  new Set(CAPABILITY_DEFS.ids.filter((id) => CAPABILITY_DEFS.get(id).default));

/** Back-compat alias — the built-in capability definitions keyed by id. */
export const CAPABILITY_CATALOG = CAPABILITY_DEFS.definition;

/** The enabled composition — the one gate every capability-aware surface reads. */
export const $capabilities = atom<ReadonlySet<Capability>>(defaultCapabilities());

/** The one gate every capability-aware surface, overlay and command reads. */
export const capabilityGate = (capability: Capability): boolean =>
  $capabilities.get().has(capability);

/**
 * The renderer the enabled composition defaults to (§2.5): a language-only
 * workspace reads as a Notebook, turning on Reasoning reframes it as a Graph.
 * Deliberately not applied at boot, where the shell's own default holds.
 */
export const defaultRendererFor = (caps: ReadonlySet<Capability>): string =>
  caps.has('reasoning') ? 'graph' : 'notebook';

/** Capabilities that carry a default-renderer opinion; toggling others never reframes the workspace. */
const RENDERER_CAPABILITIES = new Set<Capability>(['language', 'reasoning']);

export const setCapability = (id: Capability, enabled: boolean): void => {
  const next = new Set($capabilities.get());
  if (enabled) next.add(id);
  else next.delete(id);
  $capabilities.set(next);
  // Enabling Reasoning or dropping the last Language switches to the composition's default renderer.
  if (RENDERER_CAPABILITIES.has(id)) $activeRenderer.set(defaultRendererFor(next));
};

/** Registry of capabilities. */
const capabilityRegistry = new Map<string, CapabilityDescriptor>();

/** Register a capability. */
export function registerCapability(descriptor: CapabilityDescriptor): void {
  if (capabilityRegistry.has(descriptor.id)) {
    throw new Error(`Capability with id "${descriptor.id}" already registered`);
  }
  capabilityRegistry.set(descriptor.id, descriptor);
}

/** Get a capability by id. */
export function capabilityFor(id: string): CapabilityDescriptor | undefined {
  return capabilityRegistry.get(id);
}

/** All registered capabilities. */
export function getCapabilities(): readonly CapabilityDescriptor[] {
  return [...capabilityRegistry.values()];
}

/** All capability ids. */
export function capabilityIds(): readonly string[] {
  return [...capabilityRegistry.keys()];
}

/** Reset capability registry (for testing). */
export function resetCapabilities(): void {
  capabilityRegistry.clear();
  // Re-register built-in capabilities
  for (const desc of capabilityDescriptors()) {
    capabilityRegistry.set(desc.id, desc);
  }
}

// The composition is set through UI affordances; the E2E harness needs the same
// seam without reaching into the store, so it drives the real setter.
if (typeof window !== 'undefined') {
  mountTestApi('capabilities', {
    enable: (id: Capability) => setCapability(id, true),
    disable: (id: Capability) => setCapability(id, false),
    list: () => [...$capabilities.get()],
  });
}
