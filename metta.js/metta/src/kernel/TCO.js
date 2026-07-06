/**
 * Trampoline-based tail call optimization
 * Enables infinite recursion without stack overflow
 */

import {configManager} from '../config/config.js';

export class Trampoline {
    constructor() {
        this.enabled = configManager.get('tco');
    }

    run(fn, ...args) {
        if (!this.enabled) {
            return fn(...args);
        }

        let result = fn(...args);

        // Keep bouncing until we get a real value
        while (result && result._isBounce) {
            result = result.fn(...result.args);
        }

        return result;
    }
}

// Helper to create a tail call bounce
export function bounce(fn, ...args) {
    if (!configManager.get('tco')) {
        return fn(...args);
    }
    return {_isBounce: true, fn, args};
}
