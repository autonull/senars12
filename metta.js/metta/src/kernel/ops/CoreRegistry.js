import { OperationNotFoundError } from '@senars/core';

export class CoreRegistry {
    operations = new Map();

    register(name, fn, options = {}) {
        this.operations.set(this._normalize(name), { fn, options });
        return this;
    }

    has(name) {
        const n = typeof name === 'string' ? name : name?.name;
        return n != null && this.operations.has(this._normalize(n));
    }

    isLazy(name) {
        const n = typeof name === 'string' ? name : name?.name;
        return n != null && !!this.operations.get(this._normalize(n))?.options?.lazy;
    }

    isPure(name) {
        const n = typeof name === 'string' ? name : name?.name;
        return n != null && !!this.operations.get(this._normalize(n))?.options?.pure;
    }

    execute(name, ...args) {
        const n = typeof name === 'string' ? name : name?.name;
        if (!n) {
            throw new OperationNotFoundError(String(name));
        }
        const norm = this._normalize(n);
        const op = this.operations.get(norm);
        if (!op) {
            throw new OperationNotFoundError(n);
        }
        return op.fn(...args);
    }

    getOperations() {
        return Array.from(this.operations.keys());
    }

    list() {
        return this.getOperations();
    }

    clear() {
        this.operations.clear();
    }

    _normalize(name) {
        const n = typeof name === 'string' ? name : name?.name ?? String(name);
        return n.startsWith('&') ? n : `&${n}`;
    }
}
