import { mintCognitiveEvent } from '@senars/schemas';
import { asBeliefTruth } from '@senars/types/truth';
import { confidenceCeiling, SOURCE_QUALITY_CONFIDENCE } from '@senars/schemas/truth';
import { TASK_PUNCTUATION } from '@senars/schemas/task';
import { clamp01 } from '@senars/util/numeric';
import { errMsg } from '@senars/util/error';
import { makeId } from '@senars/util/id';
import { TimeoutError, withDeadline } from '@senars/util/async';
import { normalizeNarsese } from '../nl/normalize';
import { parseTaskTolerant, termParser } from '../terms';
import { KernelGate, projectOutcome } from './gate-base';
import { domainKey } from './reputation-keys';
/** The bound on the ingress judgment when config declares none. */
const DEFAULT_JUDGE_TIMEOUT_MS = 2000;
export class KernelPerceptionGate extends KernelGate {
    config;
    judge = null;
    /** D23: optional DriveManager hook — ambiguity stimulates curiosity. */
    driveManager = null;
    outcomeOf(output) {
        return projectOutcome(output, (o) => o.admitted, (o) => o.rejectionReason);
    }
    /** Wire the DriveManager so ambiguity-driven curiosity stimulation works. */
    setDriveManager(dm) {
        this.driveManager = dm;
    }
    /** Phase E: attach source reputation (trust ceiling multiplier) post-construction. */
    setReputation(reputation) {
        this.config.reputation = reputation;
    }
    constructor(config) {
        super();
        this.config = {
            defaultBudget: {
                priority: 0.5,
                durability: 0.8,
                quality: 0.9,
                cycles: 10,
                depth: 5,
                ...config?.defaultBudget,
            },
            systemOne: {
                enabled: false,
                ...config?.systemOne,
            },
        };
        if (this.config.systemOne?.enabled && this.config.systemOne.judge) {
            this.judge = this.config.systemOne.judge;
            // Judgment-resolved telemetry flows into the gate's event log via the judge.
            this.judge.setEventSink?.((event) => {
                this.emitEvent(event);
            });
        }
    }
    /** One refusal for both judge faults and judge deadlines. */
    judgeFault(correlationId, detail, kind) {
        this.recordPolicyViolation({
            policyId: 'systemone-ingress',
            violationType: 'epistemic-firewall',
            detail: `systemone_ingress_${kind}: ${detail}`,
            correlationId,
        });
        // recordGateDecision is called by decideAndRecord after this returns
        return {
            admitted: false,
            rejectionReason: 'System One ingress fault: admission rejected (fail-closed)',
        };
    }
    /** Emit a shadow validation drop event to the gate's event log. */
    emitShadowValidationDrop(event) {
        this.emitEvent(event);
    }
    async admit(input) {
        return this.decideAndRecord('perception', 'admit', input, async (inp, correlation) => this.decideAdmission(inp, correlation), (inp) => inp.correlationId);
    }
    async decideAdmission(input, correlation) {
        const sourceQuality = input.sourceQuality;
        // Phase E: the reputation multiplier lowers the trust ceiling for sources with
        // a contradiction-dominated track record; default (no record) is neutral.
        // Phase E (REFACTOR.todo2): URL-bearing source ids key by `domain:<host>`;
        // plain ids keep their exact id (legacy fallback, R6).
        const confidence = confidenceCeiling(sourceQuality, {
            reputation: this.config.reputation,
            sourceKey: domainKey(input.sourceId) ?? input.sourceId,
            scaledBy: input.sensorConfidence,
        });
        const observation = this.parseObservation(input.rawObservation);
        if (!observation.term) {
            return {
                admitted: false,
                rejectionReason: 'Failed to parse observation into valid Narsese term',
            };
        }
        const { term, taskType } = observation;
        if (this.config.systemOne?.enabled && this.judge) {
            const judged = await this.admitViaJudge(input, term, correlation(), sourceQuality, confidence, taskType);
            if (judged)
                return judged;
        }
        return this.emitAdmitted({
            term,
            taskType,
            truth: taskType === 'belief' ? { frequency: 1.0, confidence } : undefined,
            source: input.source ?? this.mapSource(input.sourceId),
            confidence,
            correlationId: correlation(),
        });
    }
    async admitViaJudge(input, term, correlationId, sourceQuality, baseConfidence, initialTaskType) {
        const rawObservation = typeof input.rawObservation === 'string'
            ? input.rawObservation
            : JSON.stringify(input.rawObservation);
        const timeoutMs = this.config.systemOne?.judgeTimeoutMs ?? DEFAULT_JUDGE_TIMEOUT_MS;
        let verdict;
        try {
            // The signal is an ask, not the bound: a judge that ignores it is still
            // bounded by the deadline, and one that honours it stops costing anything.
            verdict = await withDeadline((signal) => this.judge.judge({
                rawObservation,
                sourceQuality,
                baseConfidence,
                taskType: initialTaskType,
                signal,
            }), timeoutMs);
        }
        catch (error) {
            // Fail-closed (D1): a System One fault must never bypass the injection
            // veto via legacy admission — reject and emit ingress-error telemetry. A
            // deadline is reported as such rather than as a fault: only one of the two
            // is worth retrying.
            const expired = error instanceof TimeoutError;
            return this.judgeFault(correlationId, expired ? `judge exceeded ${timeoutMs}ms` : errMsg(error), expired ? 'timeout' : 'error');
        }
        if (verdict.vetoReason) {
            // recordGateDecision is called by decideAndRecord after this returns
            return { admitted: false, rejectionReason: verdict.vetoReason };
        }
        const taskType = verdict.taskType ?? initialTaskType;
        // D23 (TODO17b): ambiguity stimulates curiosity via the DriveManager
        // hook (wired by the NAR at init) — closes the TODO16c A4 gap.
        if (verdict.ambiguityFlag)
            this.driveManager?.stimulate('curiosity', 1);
        return this.emitAdmitted({
            term,
            taskType,
            truth: verdict.truth,
            source: input.source ?? this.mapSource(input.sourceId),
            confidence: verdict.confidence,
            correlationId,
        });
    }
    mapSource(sourceId) {
        if (sourceId.includes('user') || sourceId.includes('cli') || sourceId.includes('irc'))
            return 'user';
        if (sourceId.includes('llm') || sourceId.includes('lm'))
            return 'llm';
        if (sourceId.includes('derivation') || sourceId.includes('inference'))
            return 'derivation';
        if (sourceId.includes('reflex') || sourceId.includes('game'))
            return 'reflex';
        if (sourceId.includes('sensor') || sourceId.includes('perception'))
            return 'sensor';
        return 'user';
    }
    /**
     * One parse, both answers. A string observation was parsed by `parseTask` up to
     * four times per admission — once to reach the term and again to reach the task
     * type, off the same text — so the text is read once here and each reader of the
     * result takes what it needs.
     */
    parseObservation(observation) {
        if (typeof observation === 'string') {
            const parsed = parseTaskTolerant(observation);
            return { term: parsed?.term ?? null, taskType: parsed?.taskType ?? 'belief' };
        }
        if (observation && typeof observation === 'object') {
            const term = 'term' in observation && typeof observation.term === 'string'
                ? (parseTaskTolerant(observation.term)?.term ?? null)
                : 'kind' in observation
                    ? observation
                    : null;
            const declared = observation.type;
            return {
                term,
                taskType: declared === 'goal' || declared === 'question' || declared === 'command'
                    ? declared
                    : 'belief',
            };
        }
        return { term: null, taskType: 'belief' };
    }
    admitTask(term, taskType, truth, source = 'derivation', correlationId) {
        return this.decideAndRecord('perception', 'admitTask', { term, taskType, truth, source, correlationId }, ({ term, taskType, truth, source }, admitCorrelation) => this.decideTaskAdmission(term, taskType, truth, source, admitCorrelation), ({ correlationId }) => correlationId);
    }
    decideTaskAdmission(term, taskType, truth, source, correlation) {
        const normalized = asBeliefTruth(truth);
        return this.emitAdmitted({
            term,
            taskType,
            truth: normalized,
            source: this.mapSource(source),
            confidence: normalized?.confidence ?? 0.5,
            correlationId: correlation(),
        });
    }
    /**
     * The single admission path: budget derivation, `task.admitted` construction,
     * schema validation, and event push. Every gate entry point funnels here.
     */
    emitAdmitted(params) {
        const { term, taskType, truth, source, confidence, correlationId } = params;
        const defaults = this.config.defaultBudget;
        const task = {
            taskId: makeId(),
            term: term.toString(),
            taskType,
            ...(truth ? { truth: asBeliefTruth(truth) } : {}),
            source,
            budget: {
                priority: defaults.priority * confidence,
                durability: defaults.durability,
                quality: defaults.quality,
                cycles: defaults.cycles,
                depth: defaults.depth,
            },
        };
        const event = mintCognitiveEvent('task.admitted', {
            engine: 'kernel',
            correlationId,
            payload: task,
        });
        this.emitEvent(event);
        // recordGateDecision is called by decideAndRecord after this returns
        return { admitted: true, task };
    }
    admitFormalization(batch, sourceQuality = 'LLM_PRIOR', source = 'llm') {
        const admitted = [];
        const rejected = [];
        const correlation = () => batch.batchId;
        for (const candidate of batch.candidates) {
            const narsese = normalizeNarsese(candidate.narsese);
            const parsed = termParser.parseTask(`${narsese}${TASK_PUNCTUATION[candidate.taskType]}`);
            if (!parsed) {
                rejected.push({ candidateId: candidate.candidateId, reason: 'Unparseable Narsese' });
                continue;
            }
            const confidence = clamp01((candidate.truth?.confidence ?? candidate.confidence) *
                SOURCE_QUALITY_CONFIDENCE[sourceQuality]);
            const out = this.decideTaskAdmission(parsed.term, candidate.taskType, candidate.truth
                ? { frequency: candidate.truth.frequency, confidence }
                : { frequency: 1.0, confidence }, source, correlation);
            if (out.admitted && out.task)
                admitted.push(out.task);
            else
                rejected.push({
                    candidateId: candidate.candidateId,
                    reason: out.rejectionReason ?? 'Gate rejected',
                });
        }
        return { admitted, rejected };
    }
}
