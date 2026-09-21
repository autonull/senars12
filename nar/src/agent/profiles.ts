import type { SystemOneConfig } from '../../../src/config/schema.js';

/** Capability ladder tier: 0 reflex · 1 manifold · 2 cortex · 3 NAL-governed. */
export type CapabilityTier = 0 | 1 | 2 | 3;

/**
 * TODO19 F3: profiles are data. A named spec the NARBuilder consumes; nothing
 * is hardcoded twice. `device` tier-0 ⇒ no LM, no System One — asserted at
 * build time by the builder's subsystem absence rules.
 */
export interface NARProfileSpec {
  id: string;
  description: string;
  /** LM present ⇒ tier ≥ 1. Tier 0 profiles never touch the LM. */
  tier: CapabilityTier;
  capabilities?: {
    self?: boolean;
    lmRules?: boolean;
    rlfp?: boolean;
  };
  systemOneParams?: Partial<SystemOneConfig>;
}

export const NAR_PROFILES: Record<string, NARProfileSpec> = {
  conversation: {
    id: 'conversation',
    description: 'LM-backed chat agent: cortex ops, self-reflection, NAR engine',
    tier: 2,
    capabilities: { self: true, lmRules: true },
  },
  'tool-use': {
    id: 'tool-use',
    description: 'Tool-dispatch agent: NAR engine + groundedness heads, no self-reflection',
    tier: 2,
    capabilities: { lmRules: true },
  },
  research: {
    id: 'research',
    description: 'Deep-reasoning agent: RLFP learning loop + cognitive parameters',
    tier: 2,
    capabilities: { self: true, lmRules: true, rlfp: true },
  },
  device: {
    id: 'device',
    description: 'Tier-0 device agent: reflex only — LM never imported at runtime',
    tier: 0,
  },
  arcade: {
    id: 'arcade',
    description: 'Game-play agent: kernel-gated focus, no LM',
    tier: 0,
  },
};

export type NARProfileName = keyof typeof NAR_PROFILES;

export const resolveProfile = (name: NARProfileName | string): NARProfileSpec => {
  const spec = NAR_PROFILES[name];
  if (!spec)
    throw new Error(
      `unknown NAR profile "${name}" (known: ${Object.keys(NAR_PROFILES).join(', ')})`
    );
  return spec;
};
