import type { Agent } from './Agent.js';
import type { BackendInput } from './reasoning/BackendTypes.js';

export interface BootstrapSeed {
  beliefs?: string[];
  atoms?: Array<{ atom: string; space?: string }>;
  skills?: Array<{ name: string; code: string }>;
  links?: Array<{ narTerm: string; mettaAtom: string; relation: string }>;
}

export const DEFAULT_BOOTSTRAP_BELIEFS = [
  '<sky --> blue>.',
  '<bird --> animal>.',
  '<robin --> bird>.',
];

export const DEFAULT_SEED: BootstrapSeed = {
  beliefs: DEFAULT_BOOTSTRAP_BELIEFS,
};

async function sendBelief(agent: Agent, belief: string): Promise<void> {
  const backend = agent.getBackend('nar');
  if (!backend) return;
  await backend.reason({
    type: 'belief',
    content: belief,
    correlationId: crypto.randomUUID(),
  });
}

async function sendMetta(agent: Agent, content: string, type: BackendInput['type']): Promise<void> {
  const backend = agent.getBackend('metta');
  if (!backend) return;
  await backend.reason({
    type,
    content,
    correlationId: crypto.randomUUID(),
  });
}

export async function bootstrapAgent(
  agent: Agent,
  config: { bootstrap?: BootstrapSeed } = {},
): Promise<void> {
  const seed = config.bootstrap ?? DEFAULT_SEED;

  if (seed.beliefs?.length && agent.hasBackend('nar')) {
    for (const belief of seed.beliefs) {
      await sendBelief(agent, belief);
    }
  }

  if ((seed.atoms?.length || seed.skills?.length) && agent.hasBackend('metta')) {
    for (const a of seed.atoms ?? []) {
      await sendMetta(agent, a.atom, 'raw');
    }
    for (const s of seed.skills ?? []) {
      await sendMetta(agent, `(def ${s.name} (λ () ${s.code}))`, 'skill');
    }
  }
}
