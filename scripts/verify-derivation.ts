#!/usr/bin/env tsx
/**
 * Standalone Derivation Verifier — dependency-free proof checker.
 * Imports ONLY zod + kernel schemas (no NAR engine). Reimplements the core
 * NAL truth functions locally so engine bugs cannot mask verifier bugs.
 *
 * Usage: pnpm exec tsx scripts/verify-derivation.ts <record.json> [--strict] [--epsilon 1e-6]
 * <record.json> holds one DerivationRecord or an array of them.
 * Exit 0 when every record verifies, 1 otherwise.
 */
import {readFileSync} from 'node:fs';
import {z} from 'zod';
import {DerivationRecordSchema, type DerivationRecord, type TruthValue} from '@senars/kernel/schemas';

interface Finding {
    stepId?: string;
    check: string;
    detail: string;
}

interface VerifyResult {
    derivationId: string;
    passed: boolean;
    findings: Finding[];
    truthVerified: number;
    truthSkipped: number;
}

type TV = {f: number; c: number};
const tv = (t: TruthValue): TV => ({f: t.frequency, c: t.confidence});
const safeDiv = (n: number, d: number): number => (d === 0 ? 0 : n / d);
const c2w = (c: number): number => (c === 1 ? 1e10 : c / (1 - c));
const w2c = (w: number): number => w / (w + 1);

const BINARY: Record<string, (f1: number, f2: number, c1: number, c2: number) => [number, number]> = {
    deduction: (f1, f2, c1, c2) => [f1 * f2, c1 * c2],
    induction: (f1, f2, c1, c2) => { const w = f2 * c1 * c2; return [f2, w / (w + 1)]; },
    abduction: (f1, f2, c1, c2) => { const w = f1 * c1 * c2; return [f1, w / (w + 1)]; },
    exemplification: (f1, f2, c1, c2) => [f1 * f2, (c1 / (c1 + 1)) * c1 * c2 * f1 * f2],
    comparison: (f1, f2, c1, c2) => { const p = f1 * f2; return [safeDiv(p, p + (1 - f1) * (1 - f2)), c1 * c2]; },
    analogy: (f1, f2, c1, c2) => [f1 * f2, c1 * c2 * f2],
    resemblance: (f1, f2, c1, c2) => [(f1 + f2) / 2, c1 * c2],
    intersection: (f1, f2, c1, c2) => [f1 * f2, c1 * c2],
    union: (f1, f2, c1, c2) => [1 - (1 - f1) * (1 - f2), c1 * c2],
    revision: (f1, f2, c1, c2) => {
        const w = c2w(c1) + c2w(c2);
        return [(f1 * c2w(c1) + f2 * c2w(c2)) / w, Math.min(w2c(w), 0.999)];
    },
    detachment: (f1, f2, c1, c2) => [f2, f1 * c1 * c2],
};

const UNARY: Record<string, (f: number, c: number) => [number, number]> = {
    'negation-intro': (f, c) => [1 - f, c],
    'negation-elim': (f, c) => [1 - f, c],
    negation: (f, c) => [1 - f, c],
    conversion: (f, c) => [f, f * c],
};

type BinaryFn = (args: [number, number, number, number]) => [number, number];
type UnaryFn = (args: [number, number]) => [number, number];
const resolveFn = (ruleId: string): {kind: 'binary'; fn: BinaryFn} | {kind: 'unary'; fn: UnaryFn} | null => {
    const key = ruleId.toLowerCase().replace(/_/g, '-');
    const binary = BINARY[key];
    if (binary) return {kind: 'binary', fn: (a) => binary(a[0], a[1], a[2], a[3])};
    const unary = UNARY[key];
    if (unary) return {kind: 'unary', fn: (a) => unary(a[0], a[1])};
    for (const [name, fn] of Object.entries(BINARY)) {
        if (key.includes(name)) return {kind: 'binary', fn: (a) => fn(a[0], a[1], a[2], a[3])};
    }
    for (const [name, fn] of Object.entries(UNARY)) {
        if (key.includes(name)) return {kind: 'unary', fn: (a) => fn(a[0], a[1])};
    }
    return null;
};

export function verifyRecord(record: DerivationRecord, opts: {strict?: boolean; epsilon?: number} = {}): VerifyResult {
    const epsilon = opts.epsilon ?? 1e-6;
    const findings: Finding[] = [];
    let truthVerified = 0;
    let truthSkipped = 0;
    const fail = (check: string, detail: string, stepId?: string): void => {
        findings.push({check, detail, stepId});
    };

    const seen = new Set<string>();
    for (const step of record.steps) {
        if (seen.has(step.stepId)) fail('unique-step-id', `Duplicate stepId ${step.stepId}`, step.stepId);
        seen.add(step.stepId);

        for (const premise of step.premises) {
            if (!premise || !premise.trim()) fail('premise-shape', 'Empty premise term string', step.stepId);
        }
        if (!step.conclusion || !step.conclusion.trim()) fail('conclusion-shape', 'Empty conclusion term string', step.stepId);

        if (step.substitution) {
            for (const [variable, value] of Object.entries(step.substitution)) {
                if (!value || !value.trim()) fail('substitution-value', `Variable ${variable} binds empty value`, step.stepId);
                const inPremises = step.premises.some((p) => p.includes(variable));
                const inConclusion = step.conclusion.includes(variable) || step.conclusion.includes(value);
                if (!inPremises) fail('substitution-premise', `Variable ${variable} appears in no premise`, step.stepId);
                if (!inConclusion) fail('substitution-conclusion', `Neither ${variable} nor its value appears in conclusion`, step.stepId);
            }
        }

        const knownIds = new Set([...seen]);
        for (const parent of step.evidenceLineage) {
            if (!knownIds.has(parent) && parent !== record.taskId) {
                fail('lineage-dag', `Lineage ${parent} is neither a prior step nor the taskId`, step.stepId);
            }
        }

        if (step.independence === 'unknown' && step.ruleId.toLowerCase().includes('revision')) {
            fail('evidence-independence', 'Revision with unknown independence must be conservatively rejected by the engine', step.stepId);
        }

        const resolved = resolveFn(step.ruleId);
        if (!resolved) {
            truthSkipped++;
            if (opts.strict) fail('unknown-rule', `No truth function for ruleId '${step.ruleId}' (strict mode)`, step.stepId);
            continue;
        }
        const expectedArity = resolved.kind === 'binary' ? 2 : 1;
        if (!step.premiseTruths || step.premiseTruths.length !== expectedArity) {
            truthSkipped++;
            continue;
        }
        const fs = step.premiseTruths.map((t) => tv(t).f);
        const cs = step.premiseTruths.map((t) => tv(t).c);
        const [ef, ec] = resolved.kind === 'binary'
            ? resolved.fn([fs[0]!, fs[1]!, cs[0]!, cs[1]!])
            : resolved.fn([fs[0]!, cs[0]!]);
        const actual = tv(step.truth);
        if (Math.abs(ef! - actual.f) > epsilon || Math.abs(ec! - actual.c) > epsilon) {
            fail('truth-algebra', `Expected f=${ef!.toFixed(6)} c=${ec!.toFixed(6)}, got f=${actual.f} c=${actual.c} via ${step.ruleId}`, step.stepId);
        } else {
            truthVerified++;
        }
    }

    const last = record.steps[record.steps.length - 1];
    if (last) {
        const a = tv(record.finalTruth);
        const b = tv(last.truth);
        if (Math.abs(a.f - b.f) > epsilon || Math.abs(a.c - b.c) > epsilon) {
            fail('final-truth', 'finalTruth does not match last step truth');
        }
    } else if (record.totalCycles > 0) {
        fail('empty-derivation', 'Record claims cycles but has no steps');
    }

    return {derivationId: record.derivationId, passed: findings.length === 0, findings, truthVerified, truthSkipped};
}

const isMain = process.argv[1]?.endsWith('verify-derivation.ts') ?? false;
if (isMain) {
    const [file, ...rest] = process.argv.slice(2);
    if (!file) {
        console.error('Usage: verify-derivation.ts <record.json> [--strict] [--epsilon N]');
        process.exit(2);
    }
    const strict = rest.includes('--strict');
    const epsilonArg = rest[rest.indexOf('--epsilon') + 1];
    const epsilon = epsilonArg ? Number(epsilonArg) : 1e-6;
    const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    const parsed = z.array(DerivationRecordSchema).safeParse(raw);
    const records = parsed.success ? parsed.data : [DerivationRecordSchema.parse(raw)];
    let failed = 0;
    for (const record of records) {
        const result = verifyRecord(record, {strict, epsilon});
        console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.derivationId} (truth verified: ${result.truthVerified}, skipped: ${result.truthSkipped})`);
        for (const finding of result.findings) {
            console.log(`  [${finding.check}]${finding.stepId ? ` step ${finding.stepId}` : ''}: ${finding.detail}`);
        }
        if (!result.passed) failed++;
    }
    console.log(`${records.length - failed}/${records.length} records verified.`);
    process.exit(failed > 0 ? 1 : 0);
}
