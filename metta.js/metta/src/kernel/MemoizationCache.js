/**
 * MemoizationCache.js
 * Implements an AIKR-compliant cache with WeakMap key lookup and fixed capacity (LRU) value storage.
 */

class DoublyLinkedList {
    constructor() {
        this.head = this.tail = null;
        this.size = 0;
    }

    addToHead(node) {
        if (this.head === node) {
            return;
        }
        if (node.prev) {
            node.prev.next = node.next;
        }
        if (node.next) {
            node.next.prev = node.prev;
        }

        if (this.tail === node) {
            this.tail = node.prev;
        }

        node.prev = null;
        node.next = this.head;
        if (this.head) {
            this.head.prev = node;
        }
        this.head = node;
        if (!this.tail) {
            this.tail = node;
        }
    }

    removeTail() {
        if (!this.tail) {
            return null;
        }
        const node = this.tail;
        if (node.prev) {
            node.prev.next = null;
        } else {
            this.head = null;
        }

        this.tail = node.prev;
        node.prev = node.next = null;
        return node;
    }

    clear() {
        this.head = this.tail = null;
        this.size = 0;
    }
}

export class MemoizationCache {
    constructor(capacity = 1000) {
        this.capacity = capacity;
        this.map = new WeakMap();
        this.stringMap = new Map(); // Phase P1-E: String-key map for ground atoms
        this.lru = new DoublyLinkedList();
        this.size = 0;
        this.stats = {hits: 0, misses: 0, evictions: 0};
    }

    /**
     * Helper to pseudo-hash an atom for string map cache matching.
     * Uses flat structures if term contains interned numeric IDs.
     */
    _hashKey(term) {
        if (term.id !== undefined) {
            return String(term.id);
        }
        if (term.name) {
            return term.name;
        }
        // Phase P1-E: If term provides an Int32Array view (e.g. from Flat tensor or intern ID arrays),
        // we can hash via block bytes instead of traversing.
        return term.toString();
    }

    get(term) {
        if (!term) {
            return undefined;
        }

        let node;
        if (typeof term === 'object') {
            node = this.map.get(term);
        }

        // P1-E: Fallback to string-keyed secondary map if object isn't in WeakMap
        if (!node) {
            const key = this._hashKey(term);
            node = this.stringMap.get(key);
        }

        if (node && !node.isEvicted) {
            this.stats.hits++;
            this.lru.addToHead(node);
            return node.value;
        }

        this.stats.misses++;
        return undefined;
    }

    set(term, value) {
        if (!term) {
            return;
        }

        let node;
        const isObject = typeof term === 'object';
        let key = null;

        if (isObject) {
            node = this.map.get(term);
        } else {
            key = this._hashKey(term);
            node = this.stringMap.get(key);
        }

        if (node) {
            if (node.isEvicted) { // Resurrection
                node.isEvicted = false;
                node.value = value;
                this.size++;
            } else {
                node.value = value;
            }
            this.lru.addToHead(node);
        } else {
            node = {value, prev: null, next: null, isEvicted: false};
            if (isObject) {
                this.map.set(term, node);
                // Dual register in string map for structural cache hits across references
                key = this._hashKey(term);
                this.stringMap.set(key, node);
            } else {
                this.stringMap.set(key, node);
            }

            this.lru.addToHead(node);
            this.size++;
        }

        if (this.size > this.capacity) {
            this.evict();
        }
    }

    evict() {
        const tail = this.lru.removeTail();
        if (tail) {
            tail.value = null; // Release strong ref
            tail.isEvicted = true;
            this.size--;
            this.stats.evictions++;
        }
    }

    clear() {
        // Invalidate all nodes
        let curr = this.lru.head;
        while (curr) {
            curr.value = null;
            curr.isEvicted = true;
            curr = curr.next;
        }
        this.lru.clear();
        this.stringMap.clear();
        this.size = 0;
    }

    getStats() {
        return {size: this.size, capacity: this.capacity, ...this.stats};
    }
}
