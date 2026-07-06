/**
 * WorkerPool.js - Platform-agnostic WorkerPool facade
 */
import {ENV} from './env.js';

export class WorkerPool {
    constructor(script, size) {
        this.script = script;
        this.size = size;
        this.instance = null;
    }

    async _init() {
        if (this.instance) {
            return;
        }

        if (ENV.isNode) {
            const mod = await import('./node/WorkerPool.js');
            this.instance = new mod.WorkerPool(this.script, this.size);
        } else {
            const mod = await import('./browser/WebWorkerPool.js');
            this.instance = new mod.WebWorkerPool(this.script, this.size);
        }
    }

    async execute(task) {
        await this._init();
        return this.instance.execute(task);
    }

    async mapParallel(items, builder) {
        await this._init();
        return this.instance.mapParallel(items, builder);
    }

    terminate() {
        this.instance?.terminate();
    }
}
