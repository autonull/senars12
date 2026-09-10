import {v4 as uuidv4} from 'uuid';
import type {DerivationRecord, DerivationStep, TruthValue} from '@senars/kernel/schemas';
import type {RuleInput, RuleResult} from './processor.js';

type Independence = DerivationStep['independence'];
type RuleCategory = DerivationStep['ruleCategory'];

const CATEGORY_KEYWORDS: Array<[RuleCategory, RegExp]> = [
    ['core', /revision|choice|structural-syllogism/],
    ['propositional', /negation|conjunction|disjunction/],
    ['comparison', /comparison|analogy/],
    ['classical', /modus|hypothetical|disjunctive/],
    ['structural', /composition|decomposition|conversion/],
    ['temporal', /temporal|sequence/],
    ['procedural', /operation|goal-achievement|procedure/],
    ['meta-cognitive', /error-pattern|metacognitive|resource-allocation|strategy-effectiveness|self-model|utility-estimation|goal-execution/],
    ['variable', /variable|substitution|unification/],
    ['higher-order', /higher-order/],
    ['logic', /deduction|induction|abduction|exemplification/],
];

export function inferRuleCategory(ruleId: string): RuleCategory {
    const key = ruleId.toLowerCase();
    for (const [category, pattern] of CATEGORY_KEYWORDS) {
        if (pattern.test(key)) return category;
    }
    return 'logic';
}

const truthValue = (t: {f: number; c: number}): TruthValue => ({frequency: t.f, confidence: t.c});

const ancestorsOf = (input: RuleInput): Set<string> => {
    const set = new Set<string>();
    const stamp = input.stamp as {id?: unknown; derivations?: unknown} | undefined;
    if (stamp && typeof stamp.id === 'string') set.add(stamp.id);
    if (stamp && Array.isArray(stamp.derivations)) {
        for (const d of stamp.derivations) {
            if (typeof d === 'string') set.add(d);
        }
    }
    return set;
};

export interface RecorderOptions {
    maxStepsPerRecord?: number;
    maxCompletedRecords?: number;
    enabled?: boolean;
}

interface OpenRecord {
    derivationId: string;
    taskId: string;
    goalTerm: string;
    steps: DerivationStep[];
    stampToStep: Map<string, string>;
    maxDepth: number;
    cycles: number;
}

export class DerivationRecorder {
    private readonly maxStepsPerRecord: number;
    private readonly maxCompletedRecords: number;
    private enabled: boolean;
    private open: OpenRecord | null = null;
    private readonly completed: DerivationRecord[] = [];

    constructor(opts: RecorderOptions = {}) {
        this.maxStepsPerRecord = opts.maxStepsPerRecord ?? 200;
        this.maxCompletedRecords = opts.maxCompletedRecords ?? 200;
        this.enabled = opts.enabled ?? false;
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    begin(taskKey: string, goalTerm: string): void {
        if (!this.enabled) return;
        void taskKey;
        this.open = {
            derivationId: uuidv4(),
            taskId: uuidv4(),
            goalTerm,
            steps: [],
            stampToStep: new Map(),
            maxDepth: 0,
            cycles: 0,
        };
    }

    record(ruleId: string, p1: RuleInput, p2: RuleInput, result: RuleResult): void {
        if (!this.enabled || !this.open) return;
        if (this.open.steps.length >= this.maxStepsPerRecord) return;
        const stepId = uuidv4();
        const p1Ancestors = ancestorsOf(p1);
        const p2Ancestors = ancestorsOf(p2);
        let independence: Independence = 'independent';
        for (const a of p1Ancestors) {
            if (p2Ancestors.has(a)) {
                independence = 'dependent';
                break;
            }
        }
        const lineage = [...p1Ancestors, ...p2Ancestors]
            .map((a) => this.open?.stampToStep.get(a))
            .filter((id): id is string => typeof id === 'string')
            .slice(0, 16);
        if (lineage.length === 0) lineage.push(this.open.taskId);
        const step: DerivationStep = {
            stepId,
            ruleId,
            ruleCategory: inferRuleCategory(ruleId),
            premises: [p1.term.toString(), p2.term.toString()],
            conclusion: result.term.toString(),
            truth: truthValue(result.truth),
            premiseTruths: [truthValue(p1.truth), truthValue(p2.truth)],
            evidenceLineage: lineage,
            independence,
        };
        this.open.steps.push(step);
        const resultStamp = result.stamp as {id?: unknown} | undefined;
        if (resultStamp && typeof resultStamp.id === 'string') this.open.stampToStep.set(resultStamp.id, stepId);
        this.open.cycles++;
        this.open.maxDepth = Math.max(this.open.maxDepth, p1Ancestors.size + p2Ancestors.size);
    }

    finish(): DerivationRecord | null {
        if (!this.enabled || !this.open) {
            this.open = null;
            return null;
        }
        const open = this.open;
        this.open = null;
        if (open.steps.length === 0) return null;
        const last = open.steps[open.steps.length - 1]!;
        const record: DerivationRecord = {
            derivationId: open.derivationId,
            taskId: open.taskId,
            goalTerm: open.goalTerm,
            steps: open.steps,
            finalTruth: last.truth,
            totalCycles: open.cycles,
            maxDepthReached: open.maxDepth,
            timestamp: Date.now(),
            engine: 'nar',
        };
        this.completed.push(record);
        while (this.completed.length > this.maxCompletedRecords) this.completed.shift();
        return record;
    }

    drain(): DerivationRecord[] {
        this.finish();
        return this.completed.splice(0, this.completed.length);
    }

    pending(): number {
        return this.completed.length;
    }

    clear(): void {
        this.open = null;
        this.completed.length = 0;
    }
}
