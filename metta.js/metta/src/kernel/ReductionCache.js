import {configManager} from '../config/config.js';

export class ReductionCache {
    constructor(maxSize = configManager.get('maxCacheSize')) {
        this._map = new Map();
        this._maxSize = maxSize;
        this._stats = {hits: 0, misses: 0, puts: 0, evictions: 0};
        this.enabled = configManager.get('caching');
    }

    get(atom) {
        if (!this.enabled) return undefined;
        const key = this._key(atom);
        const val = this._map.get(key);
        if (val !== undefined) {
            this._stats.hits++;
            return val;
        }
        this._stats.misses++;
        return undefined;
    }

    set(atom, result) {
        if (!this.enabled) return;
        if (this._map.size >= this._maxSize) {
            const first = this._map.keys().next().value;
            this._map.delete(first);
            this._stats.evictions++;
        }
        this._map.set(this._key(atom), result);
        this._stats.puts++;
    }

    _key(atom) {
        return atom._hash || (atom._hash = atom.toString());
    }

    stats() {
        return this._stats;
    }

    clear() {
        this._map.clear();
        this._stats = {hits: 0, misses: 0, puts: 0, evictions: 0};
    }
}
