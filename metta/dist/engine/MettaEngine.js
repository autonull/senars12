import { Effect } from 'effect';
import { BaseEngine } from '@senars/core/engine/base';
import { createMeTTa } from '../runtime/builder.js';
import { parseMeTTa } from '../parser/runtime.js';
import { AtomKind } from '../types/ast.js';
function atomToString(atom) {
    switch (atom.kind) {
        case AtomKind.Symbol: return atom.value;
        case AtomKind.Variable: return `$${atom.name}`;
        case AtomKind.Number: return String(atom.value);
        case AtomKind.String: return `"${atom.value}"`;
        case AtomKind.Expression: {
            const expr = atom;
            const args = expr.args.map((a) => atomToString(a)).join(' ');
            return `(${atomToString(expr.operator)} ${args})`;
        }
        case AtomKind.Grounded: return `{${atom.op}}`;
        default: return String(atom);
    }
}
export class MettaEngine extends BaseEngine {
    id = 'metta';
    provides = new Set(['pattern-match', 'rewrite', 'query', 'multi-space', 'skill-execution']);
    #runtime = null;
    constructor(runtime) {
        super();
        this.#runtime = runtime ?? null;
    }
    get runtime() {
        return this.#runtime;
    }
    async doInitialize() {
        if (!this.#runtime) {
            this.#runtime = createMeTTa();
        }
    }
    async doShutdown() {
        // Effect runtimes don't need explicit shutdown
    }
    async reason(stimulus, context) {
        if (!this.#runtime)
            return [];
        const text = stimulus.text;
        if (!text.startsWith('metta:'))
            return [];
        try {
            const program = text.startsWith('metta:') ? text.slice(6) : text;
            const parsed = parseMeTTa(program);
            const result = await Effect.runPromise(this.#runtime.evaluate(parsed));
            return [{
                    term: atomToString(result),
                    timestamp: Date.now(),
                }];
        }
        catch {
            return [];
        }
    }
    async query(pattern) {
        if (!this.#runtime)
            return [];
        try {
            const program = parseMeTTa(pattern);
            const result = await Effect.runPromise(this.#runtime.evaluate(program));
            return [result];
        }
        catch {
            return [];
        }
    }
    doAbsorb(result) {
        // MeTTa can learn from tool results in future
    }
    async persist() {
        // Persistence handled by Effect runtime if needed
    }
    async load() {
        // Loading handled by Effect runtime if needed
    }
}
//# sourceMappingURL=MettaEngine.js.map