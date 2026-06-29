/**
 * Episode Logger Service
 * Handles logging to episodic memory
 */

import type {Logger} from '../../../nar/src/logger';
import {createLogger} from '../../../nar/src/logger';
import type {EpisodeType, EpisodicMemory} from '../../../nar/src/memory/EpisodicMemory.js';

export interface EpisodeLoggerConfig {
    episodicMemory?: EpisodicMemory;
    logger?: Logger;
}

export class EpisodeLogger {
    private readonly episodicMemory?: EpisodicMemory;
    private readonly logger: Logger;

    constructor(config: EpisodeLoggerConfig = {}) {
        this.episodicMemory = config.episodicMemory;
        this.logger = config.logger ?? createLogger({scope: 'agent:episodic'});
    }

    async log(
        type: EpisodeType,
        content: string,
        metadata: Record<string, unknown> = {}
    ): Promise<void> {
        if (!this.episodicMemory) return;

        try {
            await this.episodicMemory.log(type, content, metadata);
        } catch (err) {
            this.logger.warn('episodic memory log failed', {
                type,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    async logInput(content: string, metadata?: Record<string, unknown>): Promise<void> {
        await this.log('input', content, metadata);
    }

    async logResponse(content: string, metadata?: Record<string, unknown>): Promise<void> {
        await this.log('response', content, metadata);
    }

    async logBelief(content: string, metadata?: Record<string, unknown>): Promise<void> {
        await this.log('belief_added', content, metadata);
    }
}
