import type { Agent, PromptBuilder } from '@senars/core';
import type { EpisodicMemory, LMService } from '@senars/nar';
import type { SystemOneConfig } from '../../../src/config/schema.js';
import { DEFAULT_COGNITIVE_PARAMETERS, type CognitiveParameters } from '../config/cognitive-parameters.js';
import type { GateRegistry } from '../kernel/GateRegistry.js';
import { createGateRegistry } from '../kernel/GateRegistry.js';
import type { CapabilityTier } from './profiles.js';
import { resolveProfile } from './profiles.js';
export { NAR_PROFILES, resolveProfile } from './profiles.js';
export type { CapabilityTier, NARProfileName, NARProfileSpec } from './profiles.js';

type GateInitConfig = Parameters<GateRegistry['initialize']>[0];

import { NAR, type NARConfig } from '../nar.js';
import type { CreateAgentConfig } from './index.js';

export interface CapabilitySpec {
  enabled?: boolean;
  tier?: CapabilityTier;
  params?: Record<string, unknown>;
}

export interface CapabilitySurface {
  self?: CapabilitySpec;
  systemOne?: CapabilitySpec & { params?: Partial<SystemOneConfig> };
  lmRules?: CapabilitySpec;
  rlfp?: CapabilitySpec;
  nar?: CapabilitySpec;
}

export interface SystemOneSpec {
  tier: CapabilityTier;
  params?: Partial<SystemOneConfig>;
}

export interface BuilderStepRecord {
  step: string;
  present: boolean;
  detail?: Record<string, unknown>;
}

/** Typed failure of an inconsistent assembly spec (TODO19 F1). */
export class BuilderError extends Error {
  constructor(
    message: string,
    readonly step: string
  ) {
    super(`[${step}] ${message}`);
    this.name = 'BuilderError';
  }
}

/** The assembled artifact: agent + NAR + the gates instance that scopes it. */
export interface WiredNAR {
  agent: Agent & Record<string, unknown>;
  nar: NAR;
  gates: GateRegistry;
  lmService?: LMService;
  describe(): { steps: BuilderStepRecord[]; subsystems: string[] };
}

/**
 * TODO19 F1: the single assembly path for NAR-backed agents. Fluent steps
 * validate and record; a step not called ⇒ subsystem absent, never stubbed.
 */
export class NARBuilder {
  private lm?: LMService;
  private systemOne?: SystemOneSpec;
  private capabilities: CapabilitySurface = {};
  private cognitiveParams?: CognitiveParameters;
  private gates?: GateRegistry;
  private gateConfig?: GateInitConfig;
  private persistence?: { path: string };
  private episodicMemory?: EpisodicMemory;
  private sessionManager?: CreateAgentConfig['sessionManager'];
  private profile?: CreateAgentConfig['profile'];
  private skills?: CreateAgentConfig['skills'];
  private conversation?: CreateAgentConfig['conversation'];
  private engines?: CreateAgentConfig['engines'];
  private promptBuilder?: PromptBuilder;
  private narConfigOverrides: Partial<NARConfig> = {};
  private trajectoryStorePath?: string;
  private steps: BuilderStepRecord[] = [];

  /** TODO19 F3: seed the builder from a named profile preset (profiles are data). */
  static fromProfile(name: string): NARBuilder {
    const spec = resolveProfile(name);
    const b = new NARBuilder();
    if (spec.tier > 0)
      b.withSystemOne({ tier: spec.tier, params: { enabled: true, ...spec.systemOneParams } });
    const caps = Object.fromEntries(
      Object.entries(spec.capabilities ?? {}).map(([k, v]) => [k, { enabled: v }])
    ) as NARBuilder['capabilities'];
    if (Object.keys(caps).length > 0) b.withCapabilities(caps);
    return b;
  }

  private record(step: string, present: boolean, detail?: Record<string, unknown>): this {
    this.steps.push({ step, present, detail });
    return this;
  }

  withLM(lmService: LMService): this {
    this.lm = lmService;
    return this.record('lm', true);
  }

  /** System One cortex; `{ tier: 0 }` ⇒ absent (no LM-bound heads, no cortex import path). */
  withSystemOne(spec: { tier: CapabilityTier; params?: Partial<SystemOneConfig> }): this {
    this.systemOne = spec;
    return this.record('systemOne', spec.tier > 0, { tier: spec.tier });
  }

  withCapabilities(capabilities: CapabilitySurface): this {
    this.capabilities = capabilities;
    return this.record('capabilities', true, {
      self: capabilities.self?.enabled ?? false,
      rlfp: capabilities.rlfp?.enabled ?? false,
    });
  }

  /** Partial parameters merge over defaults (ParameterTable seeds, F5 substrate). */
  withParameters(cognitiveParams: CognitiveParameters): this {
    this.cognitiveParams = { ...DEFAULT_COGNITIVE_PARAMETERS, ...cognitiveParams };
    return this.record('parameters', true);
  }

  /** Per-instance kernel gates (F2) — a fresh `createGateRegistry()` (isolation) or init config. */
  withGates(spec?: GateRegistry | GateInitConfig): this {
    this.gates =
      spec instanceof Object && 'initialize' in spec
        ? (spec as GateRegistry)
        : createGateRegistry();
    this.gateConfig =
      spec instanceof Object && 'initialize' in spec ? undefined : (spec as GateInitConfig);
    return this.record('gates', true);
  }

  withPersistence(persistence: { path: string }): this {
    this.persistence = persistence;
    return this.record('persistence', true, persistence);
  }

  withMemory(episodicMemory: EpisodicMemory): this {
    this.episodicMemory = episodicMemory;
    return this.record('memory', true);
  }

  withSessionManager(sessionManager: CreateAgentConfig['sessionManager']): this {
    this.sessionManager = sessionManager;
    return this;
  }

  withProfile(profile: CreateAgentConfig['profile']): this {
    this.profile = profile;
    return this.record('profile', Boolean(profile));
  }

  withSkills(skills: CreateAgentConfig['skills']): this {
    this.skills = skills;
    return this.record('skills', Boolean(skills?.length));
  }

  withConversation(conversation: CreateAgentConfig['conversation']): this {
    this.conversation = conversation;
    return this;
  }

  withPromptBuilder(promptBuilder: PromptBuilder): this {
    this.promptBuilder = promptBuilder;
    return this;
  }

  withEngines(engines: CreateAgentConfig['engines']): this {
    this.engines = engines;
    return this;
  }

  /** Escape hatch for raw NARConfig fields (gateRegistry is always owned by the builder). */
  withNarConfig(partial: Partial<NARConfig>): this {
    this.narConfigOverrides = { ...this.narConfigOverrides, ...partial };
    return this;
  }

  withTrajectoryStorePath(path: string | undefined): this {
    if (path) {
      this.trajectoryStorePath = path;
      this.record('trajectoryStore', true, { path });
    }
    return this;
  }

  /** Validate the spec and assemble: NAR (kernel) + Agent (transport). */
  async build(): Promise<WiredNAR> {
    const systemOneEnabled = (this.systemOne?.tier ?? 0) > 0;
    const selfEnabled = this.capabilities.self?.enabled === true;

    if (
      (systemOneEnabled && (this.systemOne?.tier ?? 0) >= 2 && !this.lm) ||
      (selfEnabled && !this.lm)
    )
      throw new BuilderError(
        `tier-${systemOneEnabled ? this.systemOne?.tier : 'self'} capability requires an LM — call withLM() first`,
        'capabilities'
      );

    const narConfig = {
      ...this.narConfigOverrides,
      ...(this.lm ? { lmService: this.lm } : {}),
      ...(this.cognitiveParams ? { cognitiveParams: this.cognitiveParams } : {}),
      ...(this.capabilities.self?.enabled ? { enableSelf: true } : {}),
      ...(this.capabilities.rlfp?.enabled
        ? { enableRLFP: true, rlfp: this.capabilities.rlfp.params as NARConfig['rlfp'] }
        : {}),
      ...(this.capabilities.lmRules?.enabled ? { enableLMRules: true } : {}),
      ...(this.narConfigOverrides.systemOne
        ? {}
        : systemOneEnabled
          ? { systemOne: this.systemOne?.params }
          : {}),
    } as NARConfig;

    const gates = this.gates ?? createGateRegistry();
    gates.initialize(this.gateConfig);
    const nar = new NAR({ ...narConfig, gateRegistry: gates } as NARConfig);

    const agentConfig: CreateAgentConfig = {
      nar,
      ...(this.lm ? { lmService: this.lm } : {}),
      ...(this.episodicMemory ? { episodicMemory: this.episodicMemory } : {}),
      ...(this.persistence ? { persistence: this.persistence } : {}),
      ...(this.sessionManager ? { sessionManager: this.sessionManager } : {}),
      ...(this.profile ? { profile: this.profile } : {}),
      ...(this.skills ? { skills: this.skills } : {}),
      ...(this.conversation ? { conversation: this.conversation } : {}),
      ...(this.engines ? { engines: this.engines } : {}),
      ...(this.promptBuilder ? { promptBuilder: this.promptBuilder } : {}),
      ...(this.trajectoryStorePath ? { trajectoryStorePath: this.trajectoryStorePath } : {}),
    };

    const { createAgent } = await import('./index.js');
    const agent = (await createAgent(agentConfig)) as unknown as WiredNAR['agent'];

    return {
      agent,
      nar,
      gates,
      ...(this.lm ? { lmService: this.lm } : {}),
      describe: () => ({
        steps: [...this.steps],
        subsystems: [
          ...(this.lm ? ['lm'] : []),
          ...(systemOneEnabled ? ['systemOne'] : []),
          ...(selfEnabled ? ['self'] : []),
          ...(this.capabilities.rlfp?.enabled ? ['rlfp'] : []),
          ...(this.capabilities.lmRules?.enabled ? ['lmRules'] : []),
          ...(this.cognitiveParams ? ['cognitiveParameters'] : []),
          ...(this.episodicMemory ? ['memory'] : []),
          ...(this.persistence ? ['persistence'] : []),
        ],
      }),
    };
  }
}
