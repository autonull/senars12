import type {LinkEntry} from './types.js';
import {LinkBag} from './LinkBag.js';

export class Layer {
    readonly name: string;
    readonly capacity: number;
    protected bag: LinkBag;

    constructor(
        name: string,
        capacity: number,
        forgetPolicy: 'priority' | 'lru' | 'fifo' | 'random' = 'priority',
        onRemoved?: (entry: LinkEntry) => void
    ) {
        this.name = name;
        this.capacity = capacity;
        this.bag = new LinkBag(capacity, forgetPolicy, onRemoved);
    }

    add(_sourceHash: number, _targetHash: number, _data?: Record<string, unknown>): LinkEntry | null {
        throw new Error('Method not implemented');
    }

    remove(_sourceHash: number, _targetHash: number): boolean {
        throw new Error('Method not implemented');
    }

    get(_sourceHash: number): LinkEntry[] {
        throw new Error('Method not implemented');
    }

    applyDecay(decayRate: number): void {
        this.bag.applyDecay(decayRate);
    }

    getStats(): { size: number; capacity: number; utilization: number } {
        return {
            size: this.bag.size(),
            capacity: this.capacity,
            utilization: this.bag.size() / this.capacity,
        };
    }
}
