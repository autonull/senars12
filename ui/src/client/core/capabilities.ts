/**
 * The capability registry (§0.3, §3.6; Phase 0.6). Capabilities toggle
 * independently and change what enters the workspace, the default renderer, the
 * composer modes and overlay availability — never which zones exist. The catalog
 * is data, so the composer, commands and future `ui.command` derive availability
 * from one source instead of each hardcoding a feature flag.
 */

import { atom } from './store.js';

export const CAPABILITY_IDS = ['language', 'reasoning', 'tools', 'memory', 'uiControl'] as const;

export type Capability = (typeof CAPABILITY_IDS)[number];

export interface CapabilityDescriptor {
  readonly id: Capability;
  readonly label: string;
  readonly description: string;
  /** Part of the default composition (the LM-only product is `language`). */
  readonly default: boolean;
}

export const CAPABILITY_CATALOG = {
  language: {
    id: 'language',
    label: 'Language',
    description: 'LM conversation, segmentation and artifacts',
    default: true,
  },
  reasoning: {
    id: 'reasoning',
    label: 'Reasoning',
    description: 'Beliefs, derivations, gates and provenance',
    default: false,
  },
  tools: {
    id: 'tools',
    label: 'Tools',
    description: 'Tool calls and results',
    default: false,
  },
  memory: {
    id: 'memory',
    label: 'Memory',
    description: 'Persistent sessions',
    default: false,
  },
  uiControl: {
    id: 'uiControl',
    label: 'UI control',
    description: 'Agent-operable workspace commands',
    default: false,
  },
} as const satisfies Record<Capability, CapabilityDescriptor>;

export const capabilityDescriptors = (): CapabilityDescriptor[] =>
  CAPABILITY_IDS.map((id) => CAPABILITY_CATALOG[id]);

export const defaultCapabilities = (): Set<Capability> =>
  new Set(CAPABILITY_IDS.filter((id) => CAPABILITY_CATALOG[id].default));

/** The enabled composition — the one gate every capability-aware surface reads. */
export const $capabilities = atom<ReadonlySet<Capability>>(defaultCapabilities());

export const capabilityEnabled = (id: Capability): boolean => $capabilities.get().has(id);

export const setCapability = (id: Capability, enabled: boolean): void => {
  const next = new Set($capabilities.get());
  if (enabled) next.add(id);
  else next.delete(id);
  $capabilities.set(next);
};
