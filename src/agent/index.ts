import { createAgent, type CreateAgentConfig, type BinAgentApi, type ExtendedAgent } from './create-agent.js';

export { createAgent, type CreateAgentConfig, type BinAgentApi, type ExtendedAgent } from './create-agent.js';

export type { Agent } from '@senars/core';
export { createCortexFromLM } from '@senars/core/cortex';
export type { JsonlSessionManagerConfig } from '@senars/core/memory';
export {
  abortSession,
  createSession,
  InMemorySessionManager,
  JsonlSessionManager,
} from '@senars/core/memory';
export { dispatchToolCalls, registerAgentTools } from '@senars/core/motor';
export type { CapabilitySpec, CapabilitySurface, WiredNAR } from './builder.js';
export { BuilderError, NARBuilder } from './builder.js';
export {
  type AnswerEnvelope,
  type CognitiveAgent,
  type CognitiveAgentConfig,
  type CognitiveAgentPreset,
  createCognitiveAgent,
} from './cognitive-agent.js';
export type { NARProfileName, NARProfileSpec } from './profiles.js';
export { NAR_PROFILES, resolveProfile } from './profiles.js';