/**
 * Real-LM cognitive smoke for remember-and-recall (DoD #9).
 *
 * Mirrors the `cli-smoke.ts` structure but is narrower: just two probes
 * (belief-record + recall) so it stays well under 5 minutes on the 135M
 * model. Returns exit 0 on success, non-zero otherwise.
 */

import {AIAgent} from '../src/agent/AIAgent.ts';
import {ConversationState} from '../src/agent/ConversationState.ts';
import {EpisodicMemory} from '../src/nar/memory/EpisodicMemory.ts';
import {SeNARSFactory} from '../src/nar/index.ts';
import {createSeNARSRegistry} from '../src/nar/lm/providers.ts';
import {TransformersLMClient} from '../src/nar/lm/transformers-client.ts';
import {makeDefaultBotConfig} from '../src/config/defaults.ts';
import type {Capabilities} from '../src/agent/types.ts';

const MODEL_ID = 'HuggingFaceTB/SmolLM2-135M-Instruct';
const log = (...args: unknown[]) => console.log('[real-lm-cognitive-smoke]', ...args);

const lmClient = new TransformersLMClient(MODEL_ID);
await lmClient.init();
log(`LM ready, available=${lmClient.available}`);

const testConfig = makeDefaultBotConfig({
    reasoning: {autoTrigger: true, triggerThreshold: 0.5, triggerCooldown: 3, maxStepsPerTrigger: 5, backgroundReasoning: false, backgroundIntervalMs: 60000, lmDriven: true},
    streaming: {enabled: false, showReasoningSteps: false, showToolCalls: false},
    conversation: {maxHistory: 8, summaryThreshold: 30, maxArtifacts: 50, pinnedBeliefLimit: 8},
});

const capabilities: Capabilities = {hasLM: true, hasSeNARS: true, hasStreaming: false, hasTools: true, hasMemory: true, mode: 'full'};

const registry = createSeNARSRegistry();
const nar = SeNARSFactory.createDefault({
    providerRegistry: registry,
    core: {maxConcepts: 100, maxDerivationDepth: 8, cpuThrottleMs: 0},
});

const episodicMemory = new EpisodicMemory();

const agent = new AIAgent({
    nar,
    provider: 'transformers',
    lmClient,
    config: testConfig,
    capabilities,
    episodicMemory,
});

const conversation = new ConversationState(testConfig);

const probes: Array<{label: string; prompt: string}> = [
    {
        label: 'belief-record',
        prompt: 'Please record the fact that cats are animals by calling nar_believe with the Narsese statement "(cat --> animal)."',
    },
    {
        label: 'recall',
        prompt: 'Earlier I asked you to record something about cats. What did you record?',
    },
];

let failed = 0;
for (const probe of probes) {
    const t0 = Date.now();
    try {
        const result = await agent.executeEpisode(probe.prompt, {sender: 'smoke', connectionType: 'cli', conversation});
        const reply = result.text.length > 150 ? result.text.slice(0, 149) + '…' : result.text;
        log(
            `probe="${probe.label}" ` +
            `lmCalls=${lmClient.getStats().totalCalls} ` +
            `tools=${result.toolCalls.length} ` +
            `artifacts=${result.artifacts.length} ` +
            `t=${Date.now() - t0}ms ` +
            `text="${reply}"`,
        );
    } catch (err) {
        log(`probe="${probe.label}" ERROR: ${(err as Error).message}`);
        failed++;
    }
}

const episodes = await episodicMemory.getEpisodes({limit: 100});
const types = new Set(episodes.map(e => e.type));
log(`episodicMemory types observed: ${[...types].join(',')}`);
if (!types.has('input') || !types.has('response')) {
    log('  FAIL: episodicMemory did not record both input and response');
    failed++;
}

if (failed > 0) {
    log(`FAIL: ${failed} check(s) failed`);
    process.exit(1);
}
log('PASS: real-lm cognitive smoke OK');
process.exit(0);
