import { sym } from '../types/ast.js';
import { Cache } from './cache.js';
export class SymbolInterner {
    cache;
    constructor(opts = {}) {
        this.cache = new Cache({
            weakRefs: opts.weakRefs ?? false,
            policy: 'fifo',
        });
    }
    intern(name) {
        const cached = this.cache.get(name);
        if (cached)
            return cached;
        const symbol = sym(name);
        this.cache.set(name, symbol);
        return symbol;
    }
    get(name) {
        return this.cache.get(name);
    }
    has(name) {
        return this.cache.has(name);
    }
    clear() {
        this.cache.clear();
    }
    [Symbol.dispose]() {
        this.cache[Symbol.dispose]();
    }
}
//# sourceMappingURL=intern.js.map