import {configManager} from '../config/config.js';
import {SymbolAtom} from './AtomTypes.js';

const cache = new Map();
const stats = {internHits: 0, internMisses: 0, symbolsCreated: 0, cacheEvictions: 0};

export function intern(name) {
    if (!configManager.get('interning')) {
        stats.internMisses++;
        return new SymbolAtom(name);
    }
    const cached = cache.get(name);
    if (cached) {
        stats.internHits++;
        return cached;
    }
    const maxSize = configManager.get('maxInternedSymbols');
    if (cache.size >= maxSize) {
        const first = cache.keys().next().value;
        cache.delete(first);
        stats.cacheEvictions++;
    }
    stats.internMisses++;
    stats.symbolsCreated++;
    const atom = new SymbolAtom(name);
    cache.set(name, atom);
    return atom;
}

export function symbolEq(a, b) {
    if (a === b) return true;
    return a?.name === b?.name;
}

export function getInternStats() {
    const total = stats.internHits + stats.internMisses;
    return {
        ...stats,
        cacheSize: cache.size,
        cacheHitRate: total > 0 ? stats.internHits / total : 0
    };
}

export function clearInternCache() {
    cache.clear();
    stats.internHits = 0;
    stats.internMisses = 0;
    stats.symbolsCreated = 0;
    stats.cacheEvictions = 0;
}
