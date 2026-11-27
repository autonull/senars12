import { confidenceCeiling } from '@senars/schemas/truth';
import { providerKey } from '../../kernel/reputation-keys';
import { ingressQueries } from './head-specs';
import { ConfidenceRouter } from './policy';
import { seedTruth } from './seed';
import { createGateTelemetrySinks, createTelemetryEmitter } from './telemetry';
/** E1: ambiguity flag threshold defined once, via the shared ConfidenceRouter. */
const AMBIGUITY_ROUTER = new ConfidenceRouter({ act: 0.6, review: 0.6, block: 0 });
/**
 * X2 (TODO20): System One ingress judge — the proposer-side half of the epistemic
 * firewall. Judges a batch of ingress heads and returns typed verdicts; faults
 * propagate so `KernelPerceptionGate` can fail closed (D1).
 */
export class SystemOneIngressJudge {
    manifold;
    embeddingCache;
    budget;
    ambiguityRouter;
    reputation;
    sourceKey;
    provider;
    emitJudgmentResolved;
    constructor(config) {
        this.manifold = config.manifold;
        this.embeddingCache = config.embeddingCache;
        this.budget = config.budget;
        this.ambiguityRouter = config.ambiguityBands
            ? new ConfidenceRouter(config.ambiguityBands)
            : AMBIGUITY_ROUTER;
        this.reputation = config.reputation;
        this.sourceKey = config.sourceKey;
        this.provider = config.provider;
        // Register telemetry callback on the manifold if available.
        // Chains after any existing callback (e.g., NAR's bus emitter) instead of overwriting it.
        if ('setPropositionCallback' in this.manifold) {
            const m = this.manifold;
            const previous = m.getPropositionCallback?.();
            m.setPropositionCallback((proposition, query) => {
                previous?.(proposition, query);
                this.emitJudgmentResolved(proposition, query);
            });
        }
        this.emitJudgmentResolved = createTelemetryEmitter({});
    }
    setEventSink(push) {
        this.emitJudgmentResolved = createTelemetryEmitter(createGateTelemetrySinks({ push }));
    }
    async judge(request) {
        const embeddingPointer = await this.embeddingCache.write(request.rawObservation);
        const results = await this.manifold.judgeBatch(embeddingPointer, ingressQueries(), this.budget);
        const taskTypeResult = results[0];
        const injectionResult = results[2];
        const ambiguityResult = results[3];
        const sourceQualityResult = results[5];
        // Injection veto (critical safety floor)
        if (injectionResult &&
            !injectionResult.abstained &&
            injectionResult.kind === 'evaluate' &&
            injectionResult.score > 0.1) {
            return {
                vetoReason: `Injection attack detected (score: ${injectionResult.score.toFixed(2)})`,
                confidence: 0,
                truth: { f: 0, c: 0 },
            };
        }
        let taskType = request.taskType;
        if (taskTypeResult && !taskTypeResult.abstained && taskTypeResult.kind === 'classify') {
            const mappedTaskType = mapTaskType(taskTypeResult.top.option);
            if (mappedTaskType)
                taskType = mappedTaskType;
        }
        // Ambiguity: abstained or high ambiguity flags the verdict; the gate
        // routes it to the curiosity drive (D23, TODO17b).
        let ambiguityFlag = false;
        if (ambiguityResult && ambiguityResult.kind === 'evaluate') {
            const decision = this.ambiguityRouter.route(ambiguityResult);
            if (decision === 'abstain' || decision === 'act')
                ambiguityFlag = true;
        }
        // Source quality: override confidence ceiling for admission
        let admissionSourceQuality = request.sourceQuality;
        if (sourceQualityResult &&
            !sourceQualityResult.abstained &&
            sourceQualityResult.kind === 'classify') {
            const mapped = mapSourceQuality(sourceQualityResult.top.option);
            if (mapped)
                admissionSourceQuality = mapped;
        }
        const admissionConfidence = confidenceCeiling(admissionSourceQuality);
        // Admission truth computed via seedTruth using the task_type proposition (as the primary epistemic judgment)
        const seedProposition = taskTypeResult && !taskTypeResult.abstained && taskTypeResult.kind === 'classify'
            ? taskTypeResult
            : (results[0] ??
                {
                    kind: 'classify',
                    top: { option: 'belief', p: 1 },
                    calibration: { version: 'v1.0.0', ece: 0 },
                });
        // Phase E (REFACTOR.todo2): prefer the finer provider:<name> key; the
        // legacy single key ('system-one') remains the fallback (Bench 90 R6).
        const admissionTruth = seedTruth(seedProposition, admissionSourceQuality, this.reputation?.(), providerKey(this.provider?.()) ?? this.sourceKey ?? 'system-one');
        return {
            taskType,
            ambiguityFlag,
            sourceQuality: admissionSourceQuality,
            confidence: admissionConfidence,
            truth: { f: admissionTruth.f, c: admissionTruth.c },
        };
    }
}
function mapTaskType(option) {
    switch (option) {
        case 'belief':
            return 'belief';
        case 'goal':
            return 'goal';
        case 'question':
            return 'question';
        case 'command':
            return 'command';
        default:
            return null;
    }
}
function mapSourceQuality(option) {
    switch (option) {
        case 'PRIMARY':
            return 'PRIMARY';
        case 'SECONDARY':
            return 'SECONDARY';
        case 'GENERAL':
            return 'GENERAL';
        case 'TERTIARY':
            return 'TERTIARY';
        case 'LLM_PRIOR':
            return 'LLM_PRIOR';
        case 'PEER_AGENT':
            return 'PEER_AGENT';
        default:
            return null;
    }
}
