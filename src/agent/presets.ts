import {type Agent, type AgentOptions, createAgent} from './agent.js';
import {SeNARSFactory} from '../nar/index.js';
import {DEFAULT_NAR_CONFIG} from '../config/defaults.js';
import type {NAR} from '../nar/nar.js';
import type {LMClient} from '../nar/lm/types.js';
import {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';

export type AgentPresetName = 'minimal' | 'chat' | 'lm-only' | 'full';

export interface AgentPresetResult {
    agent: Agent;
    nar: NAR | undefined;
    lmClient: LMClient | undefined;
    episodicMemory: EpisodicMemory | undefined;
}

export interface AgentPresetDeps {
    nar?: NAR;
    lmClient?: LMClient;
    episodicMemory?: EpisodicMemory;
    systemInstructions?: string;
    baseOptions?: Partial<AgentOptions>;
}

const NARSESE_FALLBACK = 'You are SeNARS — focus on Narsese tasks; no LM configured.';

export function createAgentPreset(preset: AgentPresetName, deps: AgentPresetDeps = {}): AgentPresetResult {
    switch (preset) {
        case 'minimal': {
            const nar = deps.nar ?? SeNARSFactory.createDefault({...DEFAULT_NAR_CONFIG});
            const agent = createAgent({
                ...(deps.baseOptions ?? {}),
                nar,
                maxLoops: 0,
            });
            return {agent, nar, lmClient: undefined, episodicMemory: undefined};
        }
        case 'chat': {
            const nar = deps.nar ?? SeNARSFactory.createDefault({...DEFAULT_NAR_CONFIG, lmClient: deps.lmClient});
            const ep = deps.episodicMemory ?? createDefaultEpisodicMemory();
            const lmClient = deps.lmClient;
            const agent = createAgent({
                ...(deps.baseOptions ?? {}),
                nar,
                episodicMemory: ep,
                ...(lmClient ? {lmClient} : {}),
                ...(deps.systemInstructions ? {systemInstructions: deps.systemInstructions} : {}),
            });
            return {agent, nar, lmClient, episodicMemory: ep};
        }
        case 'lm-only': {
            const lmClient = deps.lmClient;
            if (!lmClient) throw new Error('lm-only preset requires deps.lmClient');
            const agent = createAgent({
                ...(deps.baseOptions ?? {}),
                lmClient,
                ...(deps.systemInstructions ? {systemInstructions: deps.systemInstructions} : {systemInstructions: NARSESE_FALLBACK}),
            });
            return {agent, nar: undefined, lmClient, episodicMemory: deps.episodicMemory};
        }
        case 'full': {
            const nar = deps.nar ?? SeNARSFactory.createDefault({...DEFAULT_NAR_CONFIG, lmClient: deps.lmClient});
            const lmClient = deps.lmClient;
            const ep = deps.episodicMemory ?? createDefaultEpisodicMemory();
            const agent = createAgent({
                ...(deps.baseOptions ?? {}),
                nar,
                episodicMemory: ep,
                ...(lmClient ? {lmClient} : {}),
                ...(deps.systemInstructions ? {systemInstructions: deps.systemInstructions} : {}),
            });
            return {agent, nar, lmClient, episodicMemory: ep};
        }
    }
}

function createDefaultEpisodicMemory(): EpisodicMemory {
    return new EpisodicMemory({
        enabled: true,
        maxEntriesPerFile: 100,
        basePath: process.env.EPISODIC_MEMORY_PATH || '.cache/episodes',
        retentionDays: parseInt(process.env.EPISODIC_RETENTION_DAYS || '30', 10),
    });
}
