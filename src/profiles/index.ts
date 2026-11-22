/**
 * Profiles — `senars` with profiles as data: logic, coprocessor, agent, device (+ domain packs).
 * Device profile imports zero LM.
 */

import type { Env } from '../kernel/env.js';

/** Profile kinds. */
export const PROFILE_KINDS = [
  'logic',
  'coprocessor',
  'agent',
  'device',
] as const;

export type ProfileKind = (typeof PROFILE_KINDS)[number];

/** Profile configuration. */
export interface ProfileConfig {
  /** Profile kind. */
  kind: ProfileKind;
  /** Profile name. */
  name: string;
  /** Description. */
  description: string;
  /** Whether LM is required. */
  requiresLM: boolean;
  /** Required faculties. */
  faculties: string[];
  /** Required oracles. */
  oracles: string[];
  /** Default parameters. */
  defaults: Record<string, unknown>;
  /** Packs to include. */
  packs: string[];
  /** Environment overrides. */
  envOverrides: Partial<Env>;
}

/** Profile registry. */
export class ProfileRegistry {
  private profiles: Map<ProfileKind, ProfileConfig> = new Map();
  private customProfiles: Map<string, ProfileConfig> = new Map();

  constructor() {
    this.registerDefaults();
  }

  /** Register default profiles. */
  private registerDefaults(): void {
    // Logic profile - pure reasoning, no LM
    this.register({
      kind: 'logic',
      name: 'Logic',
      description: 'Pure logical reasoning engine. No LM required. Suitable for theorem proving, verification, and formal reasoning.',
      requiresLM: false,
      faculties: ['inference', 'abduction', 'induction', 'revision'],
      oracles: ['z3', 'clingo', 'minisat', 'prolog', 'metta'],
      defaults: {
        maxDepth: 100,
        fuelBudget: 10000,
        truthThreshold: 0.5,
        enableTemporal: true,
      },
      packs: ['core-logic', 'math', 'verification'],
      envOverrides: {
        // No LM in logic profile
      },
    });

    // Coprocessor profile - logic + lightweight LM for embeddings
    this.register({
      kind: 'coprocessor',
      name: 'Coprocessor',
      description: 'Logic engine with embedding oracle for semantic search. Lightweight LM for embeddings only.',
      requiresLM: true,
      faculties: ['inference', 'abduction', 'induction', 'revision', 'grounding', 'communication'],
      oracles: ['z3', 'clingo', 'minisat', 'prolog', 'metta', 'embedding'],
      defaults: {
        maxDepth: 50,
        fuelBudget: 5000,
        truthThreshold: 0.6,
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
        enableTemporal: true,
      },
      packs: ['core-logic', 'embeddings', 'retrieval'],
      envOverrides: {
        // Lightweight LM for embeddings
      },
    });

    // Agent profile - full autonomous agent
    this.register({
      kind: 'agent',
      name: 'Agent',
      description: 'Full autonomous agent with all faculties, LM, and self-modification capabilities.',
      requiresLM: true,
      faculties: [
        'inference', 'abduction', 'induction', 'revision',
        'grounding', 'communication', 'planning', 'evaluation',
        'analogy', 'governance'
      ],
      oracles: ['z3', 'clingo', 'minisat', 'prolog', 'metta', 'embedding', 'lm', 'simulation', 'retrieval'],
      defaults: {
        maxDepth: 200,
        fuelBudget: 50000,
        truthThreshold: 0.5,
        enableTemporal: true,
        enableSelfModification: true,
        enableLearning: true,
        autonomyLevel: 'supervised',
      },
      packs: ['core-logic', 'embeddings', 'retrieval', 'planning', 'learning', 'self-mod', 'games', 'dialogue'],
      envOverrides: {
        // Full LM stack
      },
    });

    // Device profile - minimal, zero LM, edge deployment
    this.register({
      kind: 'device',
      name: 'Device',
      description: 'Minimal profile for edge/embedded deployment. Zero LM. Only essential faculties.',
      requiresLM: false,
      faculties: ['inference', 'grounding'],
      oracles: ['z3', 'minisat'], // Only WASM-compatible oracles
      defaults: {
        maxDepth: 10,
        fuelBudget: 1000,
        truthThreshold: 0.7,
        enableTemporal: false,
        wasmOnly: true,
      },
      packs: ['core-logic-minimal'],
      envOverrides: {
        // No LM, no heavy oracles
      },
    });
  }

  /** Register a profile. */
  register(config: ProfileConfig): void {
    if (PROFILE_KINDS.includes(config.kind)) {
      this.profiles.set(config.kind, config);
    } else {
      this.customProfiles.set(config.kind, config);
    }
  }

  /** Get a profile by kind. */
  get(kind: ProfileKind | string): ProfileConfig | undefined {
    return this.profiles.get(kind as ProfileKind) ?? this.customProfiles.get(kind);
  }

  /** Get all profiles. */
  getAll(): ProfileConfig[] {
    return [...this.profiles.values(), ...this.customProfiles.values()];
  }

  /** Get default profiles only. */
  getDefaults(): ProfileConfig[] {
    return Array.from(this.profiles.values());
  }

  /** Create Env from profile. */
  createEnv(kind: ProfileKind | string, overrides: Partial<Env> = {}): Env {
    const profile = this.get(kind);
    if (!profile) throw new Error(`Profile not found: ${kind}`);

    // This would be implemented with actual Env creation
    // For now, return a partial env
    return {
      ...profile.envOverrides,
      ...overrides,
    } as Env;
  }

  /** Validate profile compatibility. */
  validate(profile: ProfileConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (profile.requiresLM && profile.faculties.some(f => f === 'governance')) {
      // Governance requires LM for some operations
    }

    if (profile.kind === 'device' && profile.requiresLM) {
      errors.push('Device profile cannot require LM');
    }

    if (profile.kind === 'device' && profile.oracles.some(o => !['z3', 'minisat', 'clingo'].includes(o))) {
      errors.push('Device profile only supports WASM-compatible oracles');
    }

    return { valid: errors.length === 0, errors };
  }

  /** Get profile as JSON schema. */
  toJSONSchema(kind: ProfileKind | string): object {
    const profile = this.get(kind);
    if (!profile) throw new Error(`Profile not found: ${kind}`);

    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: profile.name,
      description: profile.description,
      type: 'object',
      properties: {
        kind: { const: profile.kind },
        faculties: { type: 'array', items: { type: 'string' }, default: profile.faculties },
        oracles: { type: 'array', items: { type: 'string' }, default: profile.oracles },
        defaults: { type: 'object', default: profile.defaults },
        packs: { type: 'array', items: { type: 'string' }, default: profile.packs },
      },
      required: ['kind'],
    };
  }
}

/** Create a profile registry. */
export function createProfileRegistry(): ProfileRegistry {
  return new ProfileRegistry();
}

/** CLI profile loader. */
export async function loadProfileFromCLI(args: string[]): Promise<ProfileConfig | null> {
  const profileArg = args.find(a => a.startsWith('--profile='));
  if (!profileArg) return null;

  const kind = profileArg.split('=')[1] as ProfileKind;
  const registry = createProfileRegistry();
  return registry.get(kind) ?? null;
}

/** Merge profiles. */
export function mergeProfiles(base: ProfileConfig, overlay: Partial<ProfileConfig>): ProfileConfig {
  return {
    ...base,
    ...overlay,
    faculties: [...new Set([...base.faculties, ...(overlay.faculties ?? [])])],
    oracles: [...new Set([...base.oracles, ...(overlay.oracles ?? [])])],
    packs: [...new Set([...base.packs, ...(overlay.packs ?? [])])],
    defaults: { ...base.defaults, ...overlay.defaults },
    envOverrides: { ...base.envOverrides, ...overlay.envOverrides },
  };
}

/** Domain packs. */
export const DOMAIN_PACKS = {
  'math': {
    name: 'Mathematics',
    description: 'Mathematical reasoning pack',
    faculties: ['inference', 'induction', 'abduction'],
    oracles: ['z3', 'clingo'],
    schemas: ['arithmetic', 'algebra', 'calculus'],
  },
  'verification': {
    name: 'Verification',
    description: 'Formal verification pack',
    faculties: ['inference', 'revision', 'governance'],
    oracles: ['z3', 'clingo', 'minisat'],
    schemas: ['temporal-logic', 'model-checking', 'proof-certificates'],
  },
  'embeddings': {
    name: 'Embeddings',
    description: 'Semantic embeddings pack',
    faculties: ['grounding', 'communication'],
    oracles: ['embedding', 'retrieval'],
    schemas: ['vector-search', 'semantic-similarity'],
  },
  'planning': {
    name: 'Planning',
    description: 'Planning and execution pack',
    faculties: ['planning', 'evaluation', 'governance'],
    oracles: ['simulation', 'lm'],
    schemas: ['task-decomposition', 'plan-execution', 'replanning'],
  },
  'learning': {
    name: 'Learning',
    description: 'Learning and adaptation pack',
    faculties: ['evaluation', 'analogy', 'governance'],
    oracles: ['lm', 'rlfp'],
    schemas: ['preference-learning', 'distillation', 'curriculum'],
  },
  'self-mod': {
    name: 'Self-Modification',
    description: 'Governed self-modification pack',
    faculties: ['governance', 'evaluation'],
    oracles: ['codemod', 'shadow-worktree'],
    schemas: ['admission-proposal', 'policy-evaluation', 'rollback'],
  },
  'games': {
    name: 'Games',
    description: 'Game environments pack',
    faculties: ['planning', 'evaluation', 'inference'],
    oracles: ['simulation'],
    schemas: ['chess', 'go', 'atari', 'procgen'],
  },
  'dialogue': {
    name: 'Dialogue',
    description: 'Natural language dialogue pack',
    faculties: ['communication', 'grounding', 'inference'],
    oracles: ['lm', 'embedding'],
    schemas: ['conversation', 'qa', 'summarization'],
  },
  'core-logic': {
    name: 'Core Logic',
    description: 'Core logical reasoning',
    faculties: ['inference', 'abduction', 'induction', 'revision'],
    oracles: ['z3', 'clingo', 'minisat', 'prolog', 'metta'],
    schemas: ['nal', 'axiomatic', 'fuzzy'],
  },
  'core-logic-minimal': {
    name: 'Core Logic (Minimal)',
    description: 'Minimal core logic for edge deployment',
    faculties: ['inference'],
    oracles: ['z3', 'minisat'],
    schemas: ['nal-basic'],
  },
  'retrieval': {
    name: 'Retrieval',
    description: 'Information retrieval pack',
    faculties: ['grounding', 'communication'],
    oracles: ['embedding', 'retrieval'],
    schemas: ['vector-index', 'keyword-search', 'hybrid-search'],
  },
} as const;

/** Get domain pack. */
export function getDomainPack(name: string): typeof DOMAIN_PACKS[keyof typeof DOMAIN_PACKS] | undefined {
  return DOMAIN_PACKS[name as keyof typeof DOMAIN_PACKS];
}

/** Get all domain packs. */
export function getAllDomainPacks(): typeof DOMAIN_PACKS {
  return DOMAIN_PACKS;
}