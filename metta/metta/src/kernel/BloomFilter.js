/**
 * BloomFilter.js
 * Space-efficient probabilistic set for MeTTa rule indexing
 */

import {configManager} from '../config/config.js';

export class BloomFilter {
    constructor(size = 10000, hashCount = 3) {
        this.size = size;
        this.hashCount = hashCount;
        this.bits = new Uint32Array(Math.ceil(size / 32));
        this.enabled = configManager.get('bloomFilter') ?? true;
    }

    add(value) {
        if (!this.enabled) {
            return;
        }

        const str = typeof value === 'string' ? value : value.toString();

        for (let i = 0; i < this.hashCount; i++) {
            const hash = this._hash(str, i);
            const index = hash % this.size;
            this._setBit(index);
        }
    }

    has(value) {
        if (!this.enabled) {
            return true;
        } // Assume present if disabled

        const str = typeof value === 'string' ? value : value.toString();

        for (let i = 0; i < this.hashCount; i++) {
            const hash = this._hash(str, i);
            const index = hash % this.size;
            if (!this._getBit(index)) {
                return false; // Definitely not present
            }
        }

        return true; // Probably present (may have false positives)
    }

    _hash(str, seed) {
        let h = seed;
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
        }
        return (h ^ (h >>> 16)) >>> 0;
    }

    _setBit(index) {
        this.bits[index >>> 5] |= (1 << (index & 31));
    }

    _getBit(index) {
        return (this.bits[index >>> 5] & (1 << (index & 31))) !== 0;
    }
}
