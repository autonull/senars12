import type {AgentOptions} from './agent.js';
import type {AgentSectionConfig} from '../config/schema.js';

export const agentConfigToOptions = (config: AgentSectionConfig): Partial<AgentOptions> => {
    const out: Partial<AgentOptions> = {
        maxLoops: config.maxLoops,
    };
    if (config.systemInstructions) out.systemInstructions = config.systemInstructions;
    return out;
};
