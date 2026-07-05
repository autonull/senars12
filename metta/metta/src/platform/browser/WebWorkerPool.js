/**
 * WebWorkerPool.js - Browser implementation of WorkerPool
 */
import {ENV} from '../env.js';

export class WebWorkerPool {
    constructor(workerScript, poolSize = (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4)) {
        if (!ENV.isBrowser && !ENV.isWorker) {
            // Warn but allow if polyfilled environment
            console.warn('WebWorkerPool: Browser environment features not detected');
        }

        this.workerScript = workerScript;
        this.workers = [];
        this.taskQueue = [];
        this.callbacks = new Map(); // id -> {resolve, reject}
        this.nextTaskId = 0;
        this.poolSize = poolSize || 4;

        this._initWorkers();
    }

    _initWorkers() {
        for (let i = 0; i < this.poolSize; i++) {
            try {
                this._addWorker();
            } catch (e) {
                console.error('Failed to create WebWorker:', e);
            }
        }
    }

    _addWorker() {
        // workerScript should be a URL or path
        const worker = new Worker(this.workerScript, {type: 'module'});

        worker.onmessage = (e) => this._handleResult(e.data, worker);
        worker.onerror = (e) => console.error('Worker error:', e);

        this.workers.push({worker, busy: false});
    }

    execute(task) {
        return new Promise((resolve, reject) => {
            const id = this.nextTaskId++;
            this.callbacks.set(id, {resolve, reject});
            this._dispatch({id, ...task});
        });
    }

    async mapParallel(items, taskBuilder) {
        return Promise.all(items.map(item => this.execute(taskBuilder(item))));
    }

    _dispatch(task) {
        const available = this.workers.find(w => !w.busy);
        if (available) {
            available.busy = true;
            available.worker.postMessage(task);
        } else {
            this.taskQueue.push(task);
        }
    }

    _handleResult(msg, workerInstance) {
        const {id, result, error} = msg;
        const cb = this.callbacks.get(id);

        if (cb) {
            this.callbacks.delete(id);
            if (error) {
                cb.reject(new Error(error));
            } else {
                cb.resolve(result);
            }
        }

        const workerWrapper = this.workers.find(w => w.worker === workerInstance);
        if (workerWrapper) {
            if (this.taskQueue.length > 0) {
                const nextTask = this.taskQueue.shift();
                workerWrapper.worker.postMessage(nextTask);
                workerWrapper.busy = true;
            } else {
                workerWrapper.busy = false;
            }
        }
    }

    terminate() {
        this.workers.forEach(w => w.worker.terminate());
        this.workers = [];
    }
}
