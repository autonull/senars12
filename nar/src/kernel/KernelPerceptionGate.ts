import { v4 as uuidv4 } from 'uuid';
import type {
    PerceptionGateInput,
    PerceptionGateOutput,
    FormalizationBatch,
    TaskAdmittedEvent,
    CognitiveEvent,
    SourceQuality,
} from '@senars/kernel/schemas';
import { validateCognitiveEvent } from '@senars/kernel/schemas';
import type { Term, TaskTypeName } from '../terms';
import { TermBuilder, termParser } from '../terms';
import { Truth } from '../terms/truth.js';

export interface KernelPerceptionGateConfig {
    defaultBudget: {
        priority: number;
        durability: number;
        quality: number;
        cycles: number;
        depth: number;
    };
}

export class KernelPerceptionGate {
    private eventLog: TaskAdmittedEvent[] = [];
    private config: KernelPerceptionGateConfig;

    constructor(config?: Partial<KernelPerceptionGateConfig>) {
        this.config = {
            defaultBudget: {
                priority: 0.5,
                durability: 0.8,
                quality: 0.9,
                cycles: 10,
                depth: 5,
                ...config?.defaultBudget,
            },
        };
    }

    admit(input: PerceptionGateInput): PerceptionGateOutput {
        const correlationId = input.correlationId ?? uuidv4();

        const sourceQuality = input.sourceQuality;
        const confidence = this.sourceQualityToConfidence(sourceQuality) * input.sensorConfidence;

        const term = this.rawObservationToTerm(input.rawObservation);
        if (!term) {
            return {
                admitted: false,
                rejectionReason: 'Failed to parse observation into valid Narsese term',
            };
        }

        const taskType = this.inferTaskType(input.rawObservation);

        const truth = taskType === 'belief'
            ? { frequency: 1.0, confidence }
            : undefined;

        const budget = {
            priority: this.config.defaultBudget.priority * confidence,
            durability: this.config.defaultBudget.durability,
            quality: this.config.defaultBudget.quality,
            cycles: this.config.defaultBudget.cycles,
            depth: this.config.defaultBudget.depth,
        };

        const taskId = uuidv4();
        const task: TaskAdmittedEvent['payload'] = {
            taskId,
            term: term.toString(),
            taskType,
            truth,
            source: this.mapSource(input.sourceId),
            budget,
        };

        const event: TaskAdmittedEvent = {
            type: 'task.admitted',
            engine: 'kernel',
            timestamp: Date.now(),
            correlationId,
            payload: task,
        };

        validateCognitiveEvent(event);
        this.eventLog.push(event);

        return { admitted: true, task };
    }

    private sourceQualityToConfidence(quality: SourceQuality): number {
        switch (quality) {
            case 'PRIMARY': return 0.9;
            case 'SECONDARY': return 0.7;
            case 'GENERAL': return 0.55;
            case 'TERTIARY': return 0.4;
            case 'LLM_PRIOR': return 0.5;
            default: return 0.5;
        }
    }

    private mapSource(sourceId: string): TaskAdmittedEvent['payload']['source'] {
        if (sourceId.includes('user') || sourceId.includes('cli') || sourceId.includes('irc')) return 'user';
        if (sourceId.includes('llm') || sourceId.includes('lm')) return 'llm';
        if (sourceId.includes('derivation') || sourceId.includes('inference')) return 'derivation';
        if (sourceId.includes('reflex') || sourceId.includes('game')) return 'reflex';
        if (sourceId.includes('sensor') || sourceId.includes('perception')) return 'sensor';
        return 'user';
    }

    private parseTaskTolerant(text: string): ReturnType<typeof termParser.parseTask> {
        return termParser.parseTask(text)
            ?? termParser.parseTask(`${text}.`)
            ?? termParser.parseTask(`${text}?`)
            ?? termParser.parseTask(`${text}!`);
    }

    private inferTaskType(observation: unknown): TaskTypeName {
        if (typeof observation === 'string') {
            const parsed = this.parseTaskTolerant(observation);
            if (parsed) return parsed.taskType;
        }
        if (observation && typeof observation === 'object' && 'type' in observation) {
            const t = (observation as { type?: string }).type;
            if (t === 'goal') return 'goal';
            if (t === 'question') return 'question';
            if (t === 'command') return 'command';
        }
        return 'belief';
    }

    private rawObservationToTerm(observation: unknown): Term | null {
        if (typeof observation === 'string') {
            return this.parseTaskTolerant(observation)?.term ?? null;
        }
        if (observation && typeof observation === 'object') {
            if ('term' in observation && typeof (observation as { term: string }).term === 'string') {
                return this.parseTaskTolerant((observation as { term: string }).term)?.term ?? null;
            }
            if ('kind' in observation) {
                return observation as Term;
            }
        }
        return null;
    }

    admitTask(term: Term, taskType: TaskTypeName, truth?: { frequency: number; confidence: number } | { f: number; c: number }, source = 'derivation', correlationId?: string): PerceptionGateOutput {
        const cid = correlationId ?? uuidv4();
        const normalized = truth ? ('frequency' in truth ? truth : { frequency: truth.f, confidence: truth.c }) : undefined;
        const confidence = normalized?.confidence ?? 0.5;
        const budget = {
            priority: this.config.defaultBudget.priority * confidence,
            durability: this.config.defaultBudget.durability,
            quality: this.config.defaultBudget.quality,
            cycles: this.config.defaultBudget.cycles,
            depth: this.config.defaultBudget.depth,
        };
        const task: TaskAdmittedEvent['payload'] = {
            taskId: uuidv4(),
            term: term.toString(),
            taskType,
            ...(normalized ? { truth: normalized } : {}),
            source: this.mapSource(source),
            budget,
        };
        const event: TaskAdmittedEvent = { type: 'task.admitted', engine: 'kernel', timestamp: Date.now(), correlationId: cid, payload: task };
        validateCognitiveEvent(event);
        this.eventLog.push(event);
        return { admitted: true, task };
    }

    admitFormalization(batch: FormalizationBatch, sourceQuality: SourceQuality = 'LLM_PRIOR'): { admitted: TaskAdmittedEvent['payload'][]; rejected: { candidateId: string; reason: string }[] } {
        const admitted: TaskAdmittedEvent['payload'][] = [];
        const rejected: { candidateId: string; reason: string }[] = [];
        for (const candidate of batch.candidates) {
            const parsed = termParser.parseTask(candidate.taskType === 'belief' ? `${candidate.narsese}.` : candidate.taskType === 'goal' ? `${candidate.narsese}!` : `${candidate.narsese}?`);
            if (!parsed) {
                rejected.push({candidateId: candidate.candidateId, reason: 'Unparseable Narsese'});
                continue;
            }
            const confidence = (candidate.truth?.confidence ?? candidate.confidence) * this.sourceQualityToConfidence(sourceQuality);
            const out = this.admitTask(parsed.term, candidate.taskType, candidate.truth ? {frequency: candidate.truth.frequency, confidence} : {frequency: 1.0, confidence}, 'llm');
            if (out.admitted && out.task) admitted.push(out.task);
            else rejected.push({candidateId: candidate.candidateId, reason: out.rejectionReason ?? 'Gate rejected'});
        }
        return {admitted, rejected};
    }

    getEventLog(): ReadonlyArray<TaskAdmittedEvent> {
        return this.eventLog;
    }

    clearEventLog(): void {
        this.eventLog = [];
    }
}