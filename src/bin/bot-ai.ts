#!/usr/bin/env tsx
/**
 * SeNARS Bot - Multi-connection agent using AIAgent
 */

import {AIAgent} from '../agent/agent.js';
import {SeNARSFactory} from '../nar/index.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {setupDefaultLMClient} from '../nar/lm/defaults.js';
import {resolveLMConfig} from '../nar/lm/env-config.js';
import {createLogger} from '../nar/logger/index.js';
import {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {DEFAULT_NAR_CONFIG} from '../config/defaults.js';
import {setupGracefulShutdown} from '../utils/shutdown.js';
import {assertValidEnv} from '../utils/env-validate.js';


assertValidEnv();

const logger = createLogger({scope: 'bot'});

async function main() {
    const registry = createSeNARSRegistry();
    const lmClient = setupDefaultLMClient();
    const lmConfig = resolveLMConfig();
    const nar = SeNARSFactory.createDefault({
        ...DEFAULT_NAR_CONFIG,
        providerRegistry: registry,
        lmClient,
    });

    const episodicMemory = new EpisodicMemory({
        enabled: true,
        maxEntriesPerFile: 100,
        basePath: process.env.EPISODIC_MEMORY_PATH || '.cache/episodes',
        retentionDays: parseInt(process.env.EPISODIC_RETENTION_DAYS || '30'),
    });

    const agent = new AIAgent({nar, lmClient, episodicMemory});
    void agent;
    logger.info(`Bot ready: AIAgent (mode=${lmClient ? 'full' : 'senars-only'})`);
    logger.info(`LM: provider=${lmConfig.provider} model=${lmConfig.model}`);

    setupGracefulShutdown(async () => {
        logger.info('Shutting down...');
        logger.info('Bot stopped');
    }, logger);
}

main().catch(console.error);
