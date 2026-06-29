import {AgentImpl} from './core/AgentImpl.js';
import {validateAgentOptions} from './options-schema.js';
import type {Agent, AgentOptions} from './types.js';

export function createAgent(opts: AgentOptions = {}): Agent {
    validateAgentOptions(opts);
    return new AgentImpl(opts);
}

export * from './types.js';
