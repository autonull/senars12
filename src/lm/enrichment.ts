import {
  degrade,
  BoundedRing,
  createLogger,
  type Logger,
  periodic,
  sortBy,
  sumBy,
} from '@senars/util';
import type { GateRegistry } from '../kernel/index.js';
import type { Memory } from '../memory';
import type { Term } from '../terms';
import { Truth } from '../terms';
import { createTask, type Task } from '../types';
import { lmTaskWeight } from './task-weights.js';
import { admitTasks } from './admit.js';

import { topBeliefTasks } from './context.js';
import { LMResponseParser } from './LMRule.js';
import type { LMService } from './lm-service.js';
import type { SystemOneLMRuleAdapter } from './system-one/rule-adapter.js';

/** F5: novelty-head budget gate (TODO16b: "novelty + budget pressure jointly trigger ProactiveEnricher"). */
export interface EnricherSystemOneDeps {
  adapter: SystemOneLMRuleAdapter;
  /** Enrich only concepts scoring at or above this on a *fitted* novelty head (unfitted ⇒ gate inactive). */
  minNovelty?: number;
}

export interface EnricherConfig {
  enableProactiveEnrichment: boolean;
  enrichmentIntervalMs: number;
  maxConceptsPerCycle: number;
  minConnectionsForEnrichment: number;
  enableExplanationGeneration: boolean;
  enableQAService: boolean;
}

export interface EnrichmentResult {
  concept: Term;
  hypotheses: Task[];
  bridges: Task[];
  explanations: string[];
}

interface ConceptConnections {
  term: Term;
  connections: number;
}

function findUnderconnectedConcepts(
  concepts: Iterable<{
    term: Term;
    beliefBag: { size(): number };
    questionBag: { size(): number };
    goalBag: { size(): number };
  }>,
  minConnections: number
): ConceptConnections[] {
  const result: ConceptConnections[] = [];

  for (const concept of concepts) {
    const connectionCount =
      concept.beliefBag.size() + concept.questionBag.size() + concept.goalBag.size();

    if (connectionCount < minConnections) {
      result.push({ term: concept.term, connections: connectionCount });
    }
  }

  return sortBy(result, (r) => r.connections);
}

export function parseEnrichmentResponse(
  response: string,
  defaultTruth?: Truth
): {
  hypotheses: Task[];
  bridges: Task[];
} {
  const lines = response.split('\n').filter((l) => l.trim());
  const hypotheses: Task[] = [];
  const bridges: Task[] = [];
  const truth = defaultTruth ?? Truth.TRUE;

  for (const line of lines) {
    const parsed = LMResponseParser.parse(line);
    if (parsed.valid && parsed.term) {
      const taskTruth = parsed.truth ?? truth;
      const task = createTask(parsed.term, 'belief', taskTruth, lmTaskWeight('enrichment'));

      if (line.includes('-->') || line.includes('<->')) {
        hypotheses.push(task);
      } else {
        bridges.push(task);
      }
    }
  }

  return { hypotheses, bridges };
}

export class ProactiveEnricher {
  /** D17: bounded results. */
  static readonly RESULTS_CAP = 100;
  private readonly memory: Memory;
  private readonly lmService: LMService;
  private readonly config: EnricherConfig;
  private readonly logger: Logger;
  private readonly systemOne?: EnricherSystemOneDeps;
  private stopEnrichmentTimer: (() => void) | undefined;
  private enrichmentCycle = 0;
  private readonly results = new BoundedRing<EnrichmentResult>(ProactiveEnricher.RESULTS_CAP);

  constructor(
    memory: Memory,
    lmService: LMService,
    private readonly gates: GateRegistry,
    config: Partial<EnricherConfig> = {},
    systemOne?: EnricherSystemOneDeps
  ) {
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

  start(): void {
    if (this.config.enableProactiveEnrichment) {
      this.stopEnrichmentTimer = periodic(
        () => this.runEnrichmentCycle(),
        this.config.enrichmentIntervalMs
      );
    }
  }

  stop(): void {
    if (this.stopEnrichmentTimer) {
      this.stopEnrichmentTimer();
      this.stopEnrichmentTimer = undefined;
    }
  }

  async runEnrichmentCycle(): Promise<EnrichmentResult[]> {
    const cycleResults: EnrichmentResult[] = [];
    this.enrichmentCycle++;

    const underconnectedConcepts = findUnderconnectedConcepts(
      this.memory.listConcepts(),
      this.config.minConnectionsForEnrichment
    );

    for (const conceptData of underconnectedConcepts.slice(0, this.config.maxConceptsPerCycle)) {
      const result = await degrade(
        this.logger,
        `Failed to enrich concept: ${conceptData.term.toString()}`,
        () => this.enrichConcept(conceptData.term),
        () => null
      );
      // D17: bounded results (drop-oldest).
      if (result && (result.hypotheses.length > 0 || result.bridges.length > 0)) {
        cycleResults.push(result);
        this.results.push(result);
      }
    }

    return cycleResults;
  }

  async generateExplanation(derivationChain: Task[]): Promise<string> {
    if (!this.config.enableExplanationGeneration) {
      return '';
    }

    const chainStr = derivationChain.map((t) => t.term.toString()).join(' -> ');
    const prompt = `Explain the following reasoning chain in natural language:
${chainStr}

Provide a clear, concise explanation of what was derived and why.`;

    return degrade(
      this.logger,
      'Failed to generate explanation',
      async () => (await this.lmService.generateText(prompt)).trim(),
      () => ''
    );
  }

  async answerQuestion(question: string, _context?: Task[]): Promise<string> {
    if (!this.config.enableQAService) {
      return '';
    }

    const memoryContext = topBeliefTasks(this.memory, { limit: 20 });
    const contextStr = memoryContext.map((t) => `${t.term.toString()}: ${t.truth.f}`).join('\n');

    const prompt = `Given the following knowledge from memory:
${contextStr}

Question: ${question}

Answer the question based on the available knowledge. If the answer cannot be determined from the context, say "I don't have enough information to answer this."`;

    return degrade(
      this.logger,
      'Failed to answer question',
      async () => (await this.lmService.generateText(prompt)).trim(),
      () => ''
    );
  }

  getEnrichmentHistory(): EnrichmentResult[] {
    return this.results.toArray();
  }

  clearHistory(): void {
    this.results.clear();
  }

  getStats(): {
    enrichmentCycles: number;
    totalConceptsEnriched: number;
    totalHypothesesGenerated: number;
    totalBridgesCreated: number;
  } {
    const totalHypotheses = sumBy(this.results, (r) => r.hypotheses.length);
    const totalBridges = sumBy(this.results, (r) => r.bridges.length);

    return {
      enrichmentCycles: this.enrichmentCycle,
      totalConceptsEnriched: this.results.size(),
      totalHypothesesGenerated: totalHypotheses,
      totalBridgesCreated: totalBridges,
    };
  }

  private async enrichConcept(term: Term): Promise<EnrichmentResult> {
    // F5 novelty gate: fitted novelty head must confirm the concept is worth
    // spending LM budget on; unfitted/abstained heads leave the heuristic intact.
    if (this.systemOne) {
      const novelty = await this.systemOne.adapter.noveltyScore(term.toString());
      if (
        novelty?.fitted &&
        !novelty.abstained &&
        novelty.score < (this.systemOne.minNovelty ?? 0.5)
      ) {
        this.logger.debug(
          `Skipping enrichment (novelty ${novelty.score.toFixed(2)} below threshold)`,
          {
            term: term.toString(),
          }
        );
        return { concept: term, hypotheses: [], bridges: [], explanations: [] };
      }
    }
    const hypothesisPrompt = this.buildHypothesisPrompt(term);
    let hypotheses: Task[] = [];
    let bridges: Task[] = [];

    const parsed = await degrade(
      this.logger,
      `Failed to generate hypotheses for term: ${term.toString()}`,
      async () => parseEnrichmentResponse(await this.lmService.generateText(hypothesisPrompt)),
      () => null
    );
    if (parsed) {
      hypotheses = parsed.hypotheses;
      bridges = parsed.bridges;
    }

    await admitTasks(this.memory, hypotheses, 'llm', this.gates);
    await admitTasks(this.memory, bridges, 'bridge-llm', this.gates);

    return { concept: term, hypotheses, bridges, explanations: [] };
  }

  private buildHypothesisPrompt(term: Term): string {
    return `Given the concept "${term.toString()}", suggest:
1. One bridging hypothesis that connects this concept to other concepts
2. One property or implication involving this concept

Respond in Narsese format, one statement per line.`;
  }
}

export const createProactiveEnricher = (
  memory: Memory,
  lmService: LMService,
  gates: GateRegistry,
  config?: Partial<EnricherConfig>,
  systemOne?: EnricherSystemOneDeps
): ProactiveEnricher => {
  return new ProactiveEnricher(memory, lmService, gates, config, systemOne);
};
