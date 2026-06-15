import type {AgentOptions} from './agent.js';
import type {AgentSectionConfig} from '../config/schema.js';

export const agentConfigToOptions = (config: AgentSectionConfig): Partial<AgentOptions> => {
    const out: Partial<AgentOptions> = {
        maxLoops: config.maxLoops,
        reasoningIntervalMs: config.reasoningIntervalMs,
        sessionHistoryLimit: config.sessionHistoryLimit,
        rateLimitPerMinute: config.rateLimitPerMinute,
        enableNlTranslation: config.enableNlTranslation,
        enableNarseseHumanization: config.enableNarseseHumanization,
    };
    if (config.systemInstructions) out.systemInstructions = config.systemInstructions;
    return out;
};
