import {createNARSTools, createGeneralTools, createWorkingMemoryTools} from '../../nar/tools/adapters/index.js';
import type {NAR} from '../../nar/nar.js';
import type {EpisodicMemory} from '../../nar/memory/EpisodicMemory.js';
import {WorkingMemory} from './WorkingMemory.js';

export interface ToolsBuilderDeps {
    nar?: NAR;
    episodicMemory?: EpisodicMemory;
}

export class ToolsBuilder {
    private cache?: Record<string, unknown>;
    constructor(private readonly deps: ToolsBuilderDeps) {}

    forEpisode(wm: WorkingMemory): Record<string, unknown> {
        return {...this.base(), ...createWorkingMemoryTools(wm)};
    }

    base(): Record<string, unknown> {
        if (this.cache) return this.cache;
        const tools: Record<string, unknown> = {};
        if (this.deps.nar) Object.assign(tools, createNARSTools(this.deps.nar));
        Object.assign(tools, createGeneralTools({
            nar: this.deps.nar,
            episodicMemory: this.deps.episodicMemory as {getEpisodes(options: {limit: number; type?: string}): Promise<unknown[]>} | undefined,
        }));
        this.cache = tools;
        return tools;
    }
}
