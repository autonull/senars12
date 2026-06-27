import {type Agent, type AgentOptions, createAgent} from './agent.js';
import type {NAR} from '../nar';
import {SeNARSFactory} from '../nar';
import {DEFAULT_NAR_CONFIG} from '../config';
import type {LMService} from '../nar/lm';
import {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';

export type AgentPresetName = 'minimal' | 'chat' | 'lm-only' | 'full';

export interface AgentPresetResult {
    agent: Agent;
    nar: NAR | undefined;
    lmService: LMService | undefined;
    episodicMemory: EpisodicMemory | undefined;
}

export interface AgentPresetDeps {
    nar?: NAR;
    lmService?: LMService;
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
            return {agent, nar, lmService: undefined, episodicMemory: undefined};
        }
        case 'chat': {
            const nar = deps.nar ?? SeNARSFactory.createDefault({...DEFAULT_NAR_CONFIG, lmService: deps.lmService});
            const ep = deps.episodicMemory ?? createDefaultEpisodicMemory();
            const lmService = deps.lmService;
            const agent = createAgent({
                ...(deps.baseOptions ?? {}),
                nar,
                episodicMemory: ep,
                ...(lmService ? {lmService} : {}),
                ...(deps.systemInstructions ? {systemInstructions: deps.systemInstructions} : {}),
            });
            return {agent, nar, lmService, episodicMemory: ep};
        }
        case 'lm-only': {
            const lmService = deps.lmService;
            if (!lmService) throw new Error('lm-only preset requires deps.lmService');
            const agent = createAgent({
                ...(deps.baseOptions ?? {}),
                lmService,
                ...(deps.systemInstructions ? {systemInstructions: deps.systemInstructions} : {systemInstructions: NARSESE_FALLBACK}),
            });
            return {agent, nar: undefined, lmService, episodicMemory: deps.episodicMemory};
        }
        case 'full': {
            const nar = deps.nar ?? SeNARSFactory.createDefault({...DEFAULT_NAR_CONFIG, lmService: deps.lmService});
            const lmService = deps.lmService;
            const ep = deps.episodicMemory ?? createDefaultEpisodicMemory();
            const agent = createAgent({
                ...(deps.baseOptions ?? {}),
                nar,
                episodicMemory: ep,
                ...(lmService ? {lmService} : {}),
                ...(deps.systemInstructions ? {systemInstructions: deps.systemInstructions} : {}),
            });
            return {agent, nar, lmService, episodicMemory: ep};
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