import type {Decision} from './decide.js';
import type {State} from './State.js';
import type {Turn} from './Turn.js';
import type {Validator, IdentityUpdate} from './validator.js';
import {isIdentityUpdate} from './validator.js';

const extractIdentityUpdate = (call: {name: string; args: Record<string, unknown>}): IdentityUpdate | null => {
    if (!isIdentityUpdate(call)) return null;
    const target = String(call.args.term ?? call.args.belief ?? call.args.target ?? '');
    if (!target) return null;
    return {
        kind: 'add',
        target,
        reason: String(call.args.reason ?? ''),
        proposedBy: 'lm',
    };
};

export const actAndReflect = (
    decision: Decision,
    state: State,
    validator?: Validator,
): Turn => {
    if (decision.kind === 'respond') {
        return {kind: 'response', text: decision.text, confidence: decision.confidence};
    }
    if (validator) {
        for (const call of decision.calls) {
            const update = extractIdentityUpdate(call);
            if (update) {
                const verdict = validator.review(update, state.identity);
                if (verdict.decision === 'reject') {
                    return {
                        kind: 'internal',
                        note: `validator-rejected: ${verdict.reason}`,
                    };
                }
            }
        }
    }
    return {kind: 'tool_calls', calls: decision.calls};
};
