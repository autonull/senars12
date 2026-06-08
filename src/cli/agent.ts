/**
 * SeNARS Agent CLI
 */

import {AIAgent} from '../agent/agent.js';
import {SeNARSFactory} from '../nar/index.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {setupDefaultLMClient} from '../nar/lm/defaults.js';
import {createLogger} from '../nar/logger/index.js';
import {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {DEFAULT_NAR_CONFIG} from '../config/defaults.js';
import {assertValidEnv} from '../utils/env-validate.js';


assertValidEnv();

const logger = createLogger({scope: 'cli:agent'});

async function main() {
    const registry = createSeNARSRegistry();
    const lmClient = setupDefaultLMClient();
    const nar = SeNARSFactory.createDefault({
        ...DEFAULT_NAR_CONFIG,
        providerRegistry: registry,
        lmClient,
    });

    const episodicMemory = new EpisodicMemory({
        enabled: true,
        maxEntriesPerFile: 100,
        basePath: process.env.EPISODIC_MEMORY_PATH || '.cache/episodes',
        retentionDays: 30,
    });

    const agent = new AIAgent({nar, lmClient, episodicMemory});
    void agent;
    logger.info('SeNARS Agent started.');
    logger.info('(No connections configured in slim v4 build)');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
