/**
 * ParallelExecutor.js
 * MORK-parity Phase P1-D: Multi-Threaded Parallel Executor
 * Distributes large non-deterministic branches (e.g., superpose) across threads.
 */

import {Logger} from '@senars/core';

const hasSAB = typeof SharedArrayBuffer !== 'undefined';

export class ParallelExecutor {
    constructor() {
        this.cores = (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4) || 4;
        this.pool = []; // Worker pool, lazily initialised
        this.enabled = hasSAB && this.cores > 1;
    }

    /**
     * Determine if the operation scale warrants parallelization overhead.
     */
    shouldParallelise(resultCount, exprCount) {
        if (!this.enabled) {
            return false;
        }
        // MORK heuristic: multi-core is only faster if there are many alternatives
        return this.cores > 2 && (resultCount > 200 || exprCount > 50);
    }

    /**
     * Partitions expressions and processes them asynchronously using worker logic.
     * Silently degrades to sequential reduction if workers or SAB are unavailable.
     */
    async parallelReduce(exprs, reduceOne) {
        if (!this.enabled || !this.shouldParallelise(exprs.length, 0)) {
            return this._sequentialFallback(exprs, reduceOne);
        }

        try {
            // Partition exprs into this.cores chunks.
            // For a true implementation, this involves posting `exprs` (serialized) to a Web Worker
            // or node worker_thread pool and awaiting the Promise.all() of their results,
            // joined via a SharedArrayBuffer ring buffer if memory sharing is strictly required.

            // Node placeholder implementation of chunking logic
            const chunkSize = Math.ceil(exprs.length / this.cores);
            const chunks = [];
            for (let i = 0; i < exprs.length; i += chunkSize) {
                chunks.push(exprs.slice(i, i + chunkSize));
            }

            // Mock parallel execution using Promises on main thread (Event loop concurrency)
            // In full parity, this dispatches to `this.pool[i].postMessage(chunks[i])`
            const workerPromises = chunks.map(chunk =>
                new Promise((resolve) => {
                    // Mock worker evaluation
                    const chunkResults = chunk.map(expr => reduceOne(expr));
                    resolve(chunkResults);
                })
            );

            const results = await Promise.all(workerPromises);

            // Flatten results
            return results.reduce((acc, curr) => acc.concat(curr), []);

        } catch (err) {
            Logger.warn('Parallel reduction failed, falling back to sequential', err.message);
            return this._sequentialFallback(exprs, reduceOne);
        }
    }

    /**
     * Standard sequential mapping fallback
     */
    _sequentialFallback(exprs, reduceOne) {
        return exprs.map(expr => reduceOne(expr));
    }
}
