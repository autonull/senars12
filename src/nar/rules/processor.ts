import type { Term } from '../terms/index.js';
import type { RegisteredRule } from './types.js';
import { RuleRegistry } from './types.js';
import { Truth } from '../terms/truth.js';
import { Stamp } from '../terms/stamp.js';

export interface RuleResult {
    term: Term;
    truth: ReturnType<typeof Truth.create>;
    stamp: ReturnType<typeof Stamp.createInput>;
    priority: number;
}

export class RuleProcessor {
    private rules = new Map<string, RegisteredRule>();

    register(rule: RegisteredRule): void {
        this.rules.set(rule.id, rule);
    }

    async *process(premises: AsyncIterable<[Term, Term]>): AsyncGenerator<RuleResult> {
        for await (const [p1, p2] of premises) {
            const rules = this.matchRules(p1, p2);

            for (const rule of rules.filter(r => r.sync)) {
                const result = rule.apply([p1, p2]);
                if (result) {
                    const truth = Truth.NEUTRAL;
                    const stamp = Stamp.createInput();
                    yield {
                        term: result as Term,
                        truth,
                        stamp,
                        priority: rule.priority
                    };
                }
            }

            for (const rule of rules.filter(r => !r.sync)) {
                Promise.resolve(rule.apply([p1, p2])).then(result => {
                    if (result) {
                        const truth = Truth.NEUTRAL;
                        const stamp = Stamp.createInput();
                        return { term: result as Term, truth, stamp, priority: rule.priority };
                    }
                }).catch((err: Error) => console.warn('LM rule failed:', err));
            }
        }
    }

    private matchRules(p1: Term, p2: Term): RegisteredRule[] {
        const rules = RuleRegistry.getAll();
        return rules.filter(r => {
            const pat = r.pattern;
            const leftOp = pat.left.op;
            const rightOp = pat.right.op;
            return (!leftOp || leftOp === '*' || leftOp === p1.kind) &&
                   (!rightOp || rightOp === '*' || rightOp === p2.kind);
        });
    }

    processSync(p1: Term, p2: Term): RuleResult[] {
        const rules = this.matchRules(p1, p2);
        const results: RuleResult[] = [];

        for (const rule of rules) {
            const result = rule.apply([p1, p2]);
            if (result) {
                const truth = Truth.NEUTRAL;
                const stamp = Stamp.createInput();
                results.push({ term: result as Term, truth, stamp, priority: rule.priority });
            }
        }

        return results;
    }
}