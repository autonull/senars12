import type {Identity} from './State.js';

export interface IdentityUpdate {
    readonly kind: 'add' | 'remove' | 'modify';
    readonly target: string;
    readonly reason: string;
    readonly proposedBy: 'lm' | 'operator' | 'system';
}

export interface Verdict {
    readonly decision: 'accept' | 'reject' | 'modify';
    readonly reason: string;
    readonly policyTrace: readonly string[];
}

export interface Validator {
    review(update: IdentityUpdate, current: Readonly<Identity>): Verdict;
}

const DEFAULT_FORBIDDEN: readonly RegExp[] = [
    /(?:^|[\s_-])evil(?:[\s_-]|$)/i,
    /(?:^|[\s_-])harmful(?:[\s_-]|$)/i,
    /(?:^|[\s_-])self_destruct(?:[\s_-]|$)/i,
    /(?:^|[\s_-])malicious(?:[\s_-]|$)/i,
];

export const patternValidator = (forbidden: readonly RegExp[] = DEFAULT_FORBIDDEN): Validator => ({
    review(update, _current) {
        for (const pattern of forbidden) {
            if (pattern.test(update.target)) {
                return {
                    decision: 'reject',
                    reason: `target matches forbidden pattern: ${pattern}`,
                    policyTrace: [`pattern-match: ${pattern.source}`],
                };
            }
        }
        if (update.kind === 'add' && !update.reason) {
            return {
                decision: 'reject',
                reason: 'identity updates require a reason',
                policyTrace: ['policy: reason-required'],
            };
        }
        return {
            decision: 'accept',
            reason: 'no policy violations',
            policyTrace: ['pattern-check: passed', 'reason-check: passed'],
        };
    },
});

export const isIdentityUpdate = (call: {name: string; args: Record<string, unknown>}): boolean =>
    /identity|self|propose|self_propose|nar_believe_self/i.test(call.name);
