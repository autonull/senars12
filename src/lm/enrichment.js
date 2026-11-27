import { degrade } from '@senars/util/error';
import { BoundedRing, sortBy } from '@senars/util/collections';
import { createLogger } from '@senars/util/logger';
import { periodic } from '@senars/util/async';
import { sumBy } from '@senars/util/numeric';
import { Truth } from '../terms';
import { createTask } from '../types';
import { lmTaskWeight } from './task-weights';
import { admitTasks } from './admit';
import { topBeliefTasks } from './context';
import { LMResponseParser } from './LMRule';
function findUnderconnectedConcepts(concepts, minConnections) {
    const result = [];
    for (const concept of concepts) {
        const connectionCount = concept.beliefBag.size + concept.questionBag.size + concept.goalBag.size;
        if (connectionCount < minConnections) {
            result.push({ term: concept.term, connections: connectionCount });
        }
    }
    return sortBy(result, (r) => r.connections);
}
export function parseEnrichmentResponse(response, defaultTruth) {
    const lines = response.split('\n').filter((l) => l.trim());
    const hypotheses = [];
    const bridges = [];
    const truth = defaultTruth ?? Truth.TRUE;
    for (const line of lines) {
        const parsed = LMResponseParser.parse(line);
        if (parsed.valid && parsed.term) {
            const taskTruth = parsed.truth ?? truth;
            const task = createTask(parsed.term, 'belief', taskTruth, lmTaskWeight('enrichment'));
            if (line.includes('-->') || line.includes('<->')) {
                hypotheses.push(task);
            }
            else {
                bridges.push(task);
            }
        }
    }
    return { hypotheses, bridges };
}
export class ProactiveEnricher {
    gates;
    /** D17: bounded results. */
    static RESULTS_CAP = 100;
    memory;
    lmService;
    config;
    logger;
    systemOne;
    stopEnrichmentTimer;
    enrichmentCycle = 0;
    results = new BoundedRing(ProactiveEnricher.RESULTS_CAP);
    constructor(memory, lmService, gates, config = {}, systemOne) {
        this.gates = gates;
        this.memory = memory;
        this.lmService = lmService;
        this.logger = createLogger({ scope: 'lm:enrichment' });
        this.systemOne = systemOne;
        this.config = {
            enableProactiveEnrichment: true,
            enrichmentIntervalMs: 60000,
            maxConceptsPerCycle: 10,
            minConnectionsForEnrichment: 2,
            enableExplanationGeneration: true,
            enableQAService: true,
            ...config,
        };
    }
    start() {
        if (this.config.enableProactiveEnrichment) {
            this.stopEnrichmentTimer = periodic(() => this.runEnrichmentCycle(), this.config.enrichmentIntervalMs);
        }
    }
    stop() {
        if (this.stopEnrichmentTimer) {
            this.stopEnrichmentTimer();
            this.stopEnrichmentTimer = undefined;
        }
    }
    async runEnrichmentCycle() {
        const cycleResults = [];
        this.enrichmentCycle++;
        const underconnectedConcepts = findUnderconnectedConcepts(this.memory.listConcepts(), this.config.minConnectionsForEnrichment);
        for (const conceptData of underconnectedConcepts.slice(0, this.config.maxConceptsPerCycle)) {
            const result = await degrade(this.logger, `Failed to enrich concept: ${conceptData.term.toString()}`, () => this.enrichConcept(conceptData.term), () => null);
            // D17: bounded results (drop-oldest).
            if (result && (result.hypotheses.length > 0 || result.bridges.length > 0)) {
                cycleResults.push(result);
                this.results.push(result);
            }
        }
        return cycleResults;
    }
    async generateExplanation(derivationChain) {
        if (!this.config.enableExplanationGeneration) {
            return '';
        }
        const chainStr = derivationChain.map((t) => t.term.toString()).join(' -> ');
        const prompt = `Explain the following reasoning chain in natural language:
${chainStr}

Provide a clear, concise explanation of what was derived and why.`;
        return degrade(this.logger, 'Failed to generate explanation', async () => (await this.lmService.generateText(prompt)).trim(), () => '');
    }
    async answerQuestion(question, _context) {
        if (!this.config.enableQAService) {
            return '';
        }
        const memoryContext = topBeliefTasks(this.memory, { limit: 20 });
        const contextStr = memoryContext.map((t) => `${t.term.toString()}: ${t.truth.f}`).join('\n');
        const prompt = `Given the following knowledge from memory:
${contextStr}

Question: ${question}

Answer the question based on the available knowledge. If the answer cannot be determined from the context, say "I don't have enough information to answer this."`;
        return degrade(this.logger, 'Failed to answer question', async () => (await this.lmService.generateText(prompt)).trim(), () => '');
    }
    getEnrichmentHistory() {
        return this.results.toArray();
    }
    clearHistory() {
        this.results.clear();
    }
    getStats() {
        const totalHypotheses = sumBy(this.results, (r) => r.hypotheses.length);
        const totalBridges = sumBy(this.results, (r) => r.bridges.length);
        return {
            enrichmentCycles: this.enrichmentCycle,
            totalConceptsEnriched: this.results.size(),
            totalHypothesesGenerated: totalHypotheses,
            totalBridgesCreated: totalBridges,
        };
    }
    async enrichConcept(term) {
        // F5 novelty gate: fitted novelty head must confirm the concept is worth
        // spending LM budget on; unfitted/abstained heads leave the heuristic intact.
        if (this.systemOne) {
            const novelty = await this.systemOne.adapter.noveltyScore(term.toString());
            if (novelty?.fitted &&
                !novelty.abstained &&
                novelty.score < (this.systemOne.minNovelty ?? 0.5)) {
                this.logger.debug(`Skipping enrichment (novelty ${novelty.score.toFixed(2)} below threshold)`, {
                    term: term.toString(),
                });
                return { concept: term, hypotheses: [], bridges: [], explanations: [] };
            }
        }
        const hypothesisPrompt = this.buildHypothesisPrompt(term);
        let hypotheses = [];
        let bridges = [];
        const parsed = await degrade(this.logger, `Failed to generate hypotheses for term: ${term.toString()}`, async () => parseEnrichmentResponse(await this.lmService.generateText(hypothesisPrompt)), () => null);
        if (parsed) {
            hypotheses = parsed.hypotheses;
            bridges = parsed.bridges;
        }
        await admitTasks(this.memory, hypotheses, 'llm', this.gates);
        await admitTasks(this.memory, bridges, 'bridge-llm', this.gates);
        return { concept: term, hypotheses, bridges, explanations: [] };
    }
    buildHypothesisPrompt(term) {
        return `Given the concept "${term.toString()}", suggest:
1. One bridging hypothesis that connects this concept to other concepts
2. One property or implication involving this concept

Respond in Narsese format, one statement per line.`;
    }
}
export const createProactiveEnricher = (memory, lmService, gates, config, systemOne) => {
    return new ProactiveEnricher(memory, lmService, gates, config, systemOne);
};
