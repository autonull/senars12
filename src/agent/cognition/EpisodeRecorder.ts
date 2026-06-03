import type {SelfAnalyzerService} from '../services/SelfAnalyzerService.js';
import type {ConsolidationEngine, EpisodeRecord} from './ConsolidationEngine.js';
import type {AIAgentConfig, ReasoningArtifact, Route} from '../types.js';
import type {WorkingMemory} from './WorkingMemory.js';
import type {EpisodeResult} from './EpisodeTypes.js';

export interface EpisodeRecorderDeps {
    selfAnalyzer?: SelfAnalyzerService;
    consolidation: ConsolidationEngine;
    config: AIAgentConfig['config'];
    turnCount: () => number;
}

export class EpisodeRecorder {
    constructor(private readonly deps: EpisodeRecorderDeps) {}

    record(
        input: string,
        result: EpisodeResult,
        r: Route,
        wm: WorkingMemory,
        signal: AbortSignal,
    ): void {
        const record: EpisodeRecord = {
            id: `${result.metrics.cycleCount}-${Date.now()}`,
            timestamp: Date.now(),
            input,
            response: result.text,
            concepts: [...new Set([
                ...(r.kind === 'nl' ? r.concepts : []),
                ...(r.kind === 'narsese-belief' || r.kind === 'narsese-question' ? r.concepts : []),
                ...extractConceptsFromArtifacts(result.artifacts),
            ])],
            artifacts: result.artifacts,
            routeKind: r.kind,
        };
        this.deps.consolidation.schedule(record, signal);
    }

    updatePolicy(r: Route, result: EpisodeResult): void {
        if (!this.deps.selfAnalyzer) return;
        this.deps.selfAnalyzer.recordRoute(r.kind);
        for (const tc of result.toolCalls) this.deps.selfAnalyzer.recordTool(tc.toolName);
        if (this.deps.turnCount() > 0 && this.deps.turnCount() % this.deps.config.policy.selfAnalysisEveryN === 0) {
            this.deps.selfAnalyzer.recomputePolicy();
        }
    }
}

function extractConceptsFromArtifacts(artifacts: ReasoningArtifact[]): string[] {
    const out: string[] = [];
    for (const a of artifacts) {
        const belief = a.metadata?.belief;
        if (typeof belief === 'string') out.push(belief);
    }
    return out;
}
