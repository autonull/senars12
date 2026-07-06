/**
 * TermPool.js - Object pooling for frequently created terms
 * Reduces GC pressure by reusing term objects
 */

/**
 * Base pool implementation with common functionality
 */
class BasePool {
    constructor(initialSize = 100, maxSize = 1000) {
        this.pool = [];
        this.maxSize = maxSize;
        this.stats = {created: 0, reused: 0, released: 0};

        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this._createItem());
        }
    }

    _createItem() {
        throw new Error('Subclasses must implement _createItem()');
    }

    acquire() {
        const item = this.pool.pop();
        if (item) {
            this.stats.reused++;
            return item;
        }
        this.stats.created++;
        return this._createItem();
    }

    release(item) {
        if (item?._pooled && this.pool.length < this.maxSize) {
            item.reset?.();
            this.pool.push(item);
            this.stats.released++;
        }
    }

    getStats() {
        return {
            ...this.stats,
            poolSize: this.pool.length,
            reuseRate: this.stats.reused / (this.stats.created + this.stats.reused) * 100
        };
    }

    clear() {
        this.pool = [];
        this.stats = {created: 0, reused: 0, released: 0};
    }
}

/**
 * Symbol pool with name-based caching
 */
export class SymbolPool extends BasePool {
    constructor(initialSize = 200, maxSize = 2000) {
        super(initialSize, maxSize);
        this.cache = new Map();
    }

    _createItem() {
        return {
            _type: 'atom',
            _name: null,
            _operator: null,
            _components: [],
            _complexity: 1,
            _id: null,
            _hash: null,
            _semanticType: 'nal_concept',
            _typeTag: 1,
            _pooled: true,
            reset(name) {
                this._name = name;
                this._id = name;
                this._hash = null;
                this._components = [name];
                return this;
            }
        };
    }

    get(name) {
        if (this.cache.has(name)) {
            this.stats.reused++;
            return this.cache.get(name);
        }

        const symbol = this.pool.pop() ?? this._createItem();
        symbol.reset(name);
        this.stats.created++;

        if (this.cache.size < this.maxSize) {
            this.cache.set(name, symbol);
        }

        return symbol;
    }

    release(symbol) {
        if (symbol?._pooled && this.pool.length < this.maxSize) {
            this.cache.delete(symbol._name);
            symbol.reset();
            this.pool.push(symbol);
        }
    }

    getStats() {
        return {
            ...super.getStats(),
            cacheSize: this.cache.size,
            hitRate: this.stats.reused / (this.stats.created + this.stats.reused) * 100
        };
    }
}

/**
 * Expression pool for compound terms
 */
export class ExpressionPool extends BasePool {
    constructor(initialSize = 100, maxSize = 1000) {
        super(initialSize, maxSize);
    }

    _createItem() {
        return {
            type: 'compound',
            name: null,
            operator: null,
            components: [],
            _typeTag: 3,
            _hash: null,
            _metadata: null,
            _pooled: true,
            reset(operator, components) {
                this.operator = operator;
                this.components = components ?? [];
                this.name = this._computeName();
                this._hash = null;
                return this;
            },
            _computeName() {
                const opName = this.operator?._name ?? this.operator?.name ?? '?';
                return `(${opName}${this.components.map(c => ` ${c._name ?? c.name ?? '?'}`).join('')})`;
            }
        };
    }

    acquire(operator, components) {
        const expr = this.pool.pop();
        if (expr) {
            this.stats.reused++;
            return expr.reset(operator, components);
        }
        this.stats.created++;
        return this._create(operator, components);
    }

    _create(operator, components) {
        const name = this._computeName(operator, components);
        return {
            type: 'compound',
            name,
            operator,
            components: components ?? [],
            _typeTag: 3,
            _hash: null,
            _metadata: null
        };
    }

    _computeName(operator, components) {
        const opName = operator?._name ?? operator?.name ?? '?';
        return `(${opName}${(components ?? []).map(c => ` ${c._name ?? c.name ?? '?'}`).join('')})`;
    }
}

/**
 * Global pool instances
 */
export const globalSymbolPool = new SymbolPool(500, 5000);
export const globalExpressionPool = new ExpressionPool(200, 2000);

/**
 * Create symbol using pool
 */
export function pooledSym(name) {
    return globalSymbolPool.get(name);
}

/**
 * Create expression using pool
 */
export function pooledExp(operator, components) {
    return globalExpressionPool.acquire(operator, components);
}
