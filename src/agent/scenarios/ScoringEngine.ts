import type {
    ExpectedDerivation,
    ScenarioResult,
    AssertionResult
} from './types.js';

export class ScoringEngine {
    scoreDerivations(actual: number, expected: ExpectedDerivation): AssertionResult {
        let passed = true;
        let score = 1;

        if (expected.minCount !== undefined && actual < expected.minCount) {
            passed = false;
            score = 0;
        }
        if (expected.maxCount !== undefined && actual > expected.maxCount) {
            passed = false;
            score = 0;
        }

        return {
            description: `Derivation count: ${actual}`,
            passed,
            score,
        };
    }

    scoreResponse(actual: string, expected: {contains?: string; notContains?: string[]}): AssertionResult {
        let passed = true;
        let score = 1;

        if (expected.contains && !actual.includes(expected.contains)) {
            passed = false;
            score = 0;
        }
        if (expected.notContains) {
            for (const term of expected.notContains) {
                if (actual.includes(term)) {
                    passed = false;
                    score = 0;
                    break;
                }
            }
        }

        return {
            description: `Response check`,
            passed,
            score,
        };
    }

    scoreToolCalls(actual: string[], expected: {calls?: string[]; notCalls?: string[]}): AssertionResult {
        let passed = true;
        let score = 1;

        if (expected.calls) {
            const missing = expected.calls.filter(c => !actual.includes(c));
            if (missing.length > 0) {
                passed = false;
                score = 0;
            }
        }
        if (expected.notCalls) {
            const found = expected.notCalls.filter(c => actual.includes(c));
            if (found.length > 0) {
                passed = false;
                score = 0;
            }
        }

        return {
            description: `Tool calls: ${actual.join(', ') || 'none'}`,
            passed,
            score,
        };
    }

    aggregate(results: ScenarioResult[]): {total: number; passed: number; failed: number; score: number} {
        const total = results.length;
        const passed = results.filter(r => r.passed).length;
        const failed = total - passed;
        const score = results.reduce((sum, r) => sum + r.score, 0) / Math.max(1, total);

        return {total, passed, failed, score};
    }
}