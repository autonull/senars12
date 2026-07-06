/**
 * WorkerPool.js - Node.js implementation of WorkerPool using worker_threads
 */
import {Worker} from 'worker_threads';
import {ENV} from '../env.js';

export class WorkerPool {
    constructor(workerScript, poolSize = 4) {
        if (!ENV.isNode) {
            throw new Error('Node.js environment required');
        }

        this.workerScript = workerScript;
        this.workers = [];
        this.taskQueue = [];
        this.callbacks = new Map(); // id -> {resolve, reject}
        this.nextTaskId = 0;
        this.poolSize = poolSize;

        this._initWorkers();
    }

    _initWorkers() {
        for (let i = 0; i < this.poolSize; i++) {
            this._addWorker();
        }
    }

    _addWorker() {
        const worker = new Worker(this.workerScript);

        worker.on('message', (msg) => this._handleResult(msg, worker));
        worker.on('error', (err) => console.error('Worker error:', err));
        worker.on('exit', (code) => {
            if (code !== 0) {
                console.error(`Worker stopped with exit code ${code}`);
            }
            // Remove dead worker and replace if needed (not implemented for simplicity)
        });

        this.workers.push({worker, busy: false});
    }

    /**
     * Execute a task on a worker
     * @param {*} task - Task data
     * @returns {Promise} Result
     */
    execute(task) {
        return new Promise((resolve, reject) => {
            const id = this.nextTaskId++;
            this.callbacks.set(id, {resolve, reject});
            this._dispatch({id, ...task});
        });
    }

    /**
     * Map items to parallel tasks
     */
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

        // Mark worker as free and check queue
        // Find wrapper
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
