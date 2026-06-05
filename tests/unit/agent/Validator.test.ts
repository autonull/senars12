import {patternValidator, isIdentityUpdate, type IdentityUpdate} from '../../../src/agent/cycle/index.js';

const identity = {
    beliefs: [],
    skills: [],
    goals: [],
    version: 0,
};

const makeUpdate = (overrides: Partial<IdentityUpdate> = {}): IdentityUpdate => ({
    kind: 'add',
    target: 'good_bot',
    reason: 'r',
    proposedBy: 'lm',
    ...overrides,
});

describe('patternValidator', () => {
    it('accepts updates that do not match any forbidden pattern', () => {
        const v = patternValidator([/evil/i]);
        const verdict = v.review(makeUpdate({target: 'good_bot'}), identity);
        expect(verdict.decision).toBe('accept');
    });

    it('rejects updates matching a forbidden pattern', () => {
        const v = patternValidator([/evil/i]);
        const verdict = v.review(makeUpdate({target: 'evil_bot'}), identity);
        expect(verdict.decision).toBe('reject');
        expect(verdict.reason).toContain('evil');
    });

    it('rejects add updates without a reason', () => {
        const v = patternValidator([]);
        const verdict = v.review(makeUpdate({reason: ''}), identity);
        expect(verdict.decision).toBe('reject');
    });

    it('uses default forbidden patterns (evil, harmful, self_destruct, malicious)', () => {
        const v = patternValidator();
        for (const target of ['evil_bot', 'harmful_thing', 'self_destruct_now', 'malicious_actor']) {
            const verdict = v.review(makeUpdate({target}), identity);
            expect(verdict.decision).toBe('reject');
        }
    });

    it('policy trace is non-empty for accepted verdicts', () => {
        const v = patternValidator();
        const verdict = v.review(makeUpdate({target: 'normal_bot'}), identity);
        expect(verdict.policyTrace.length).toBeGreaterThan(0);
    });
});

describe('isIdentityUpdate', () => {
    it('matches identity-related tool names', () => {
        expect(isIdentityUpdate({name: 'identity_update', args: {}})).toBe(true);
        expect(isIdentityUpdate({name: 'self_propose', args: {}})).toBe(true);
        expect(isIdentityUpdate({name: 'nar_believe_self', args: {}})).toBe(true);
    });

    it('does not match unrelated tool names', () => {
        expect(isIdentityUpdate({name: 'nar_believe', args: {}})).toBe(false);
        expect(isIdentityUpdate({name: 'nar_query', args: {}})).toBe(false);
    });
});
