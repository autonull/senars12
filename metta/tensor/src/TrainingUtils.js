export class DataLoader {
    constructor(dataset, batchSize = 32, shuffle = false, collateFn = null) {
        Object.assign(this, {dataset, batchSize, shuffle, collateFn: collateFn ?? (batch => batch)});
    }

    * [Symbol.iterator]() {
        const indices = [...Array(this.dataset.length).keys()];
        if (this.shuffle) {
            for (let i = indices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [indices[i], indices[j]] = [indices[j], indices[i]];
            }
        }
        for (let i = 0; i < indices.length; i += this.batchSize) {
            yield this.collateFn(indices.slice(i, i + this.batchSize).map(idx => this.dataset[idx]));
        }
    }
}

export class LRScheduler {
    constructor(optimizer, mode = 'step', ...args) {
        Object.assign(this, {
            optimizer,
            mode,
            baseLR: optimizer.lr,
            stepSize: args[0] ?? 30,
            gamma: args[1] ?? 0.1,
            maxEpochs: args[2] ?? 100
        });
    }

    step(epoch) {
        const schedules = {
            step: () => this.baseLR * Math.pow(this.gamma, Math.floor(epoch / this.stepSize)),
            exponential: () => this.baseLR * Math.exp(-0.1 * epoch),
            cosine: () => this.baseLR * 0.5 * (1 + Math.cos(Math.PI * epoch / this.maxEpochs))
        };
        if (!schedules[this.mode]) {
            throw new Error(`Unknown LR scheduler mode: ${this.mode}`);
        }
        this.optimizer.lr = schedules[this.mode]();
    }
}

export class EarlyStopping {
    constructor(patience = 5, minDelta = 0) {
        Object.assign(this, {patience, minDelta, bestLoss: Infinity, counter: 0});
    }

    step(loss) {
        if (loss < this.bestLoss - this.minDelta) {
            this.bestLoss = loss;
            this.counter = 0;
            return false;
        }
        return ++this.counter >= this.patience;
    }

    reset() {
        this.bestLoss = Infinity;
        this.counter = 0;
    }
}

export class MetricsTracker {
    constructor() {
        this.history = {};
    }

    log(epoch, metrics) {
        Object.entries(metrics).forEach(([key, value]) => {
            (this.history[key] ??= []).push({epoch, value});
        });
    }

    get(metric) {
        return this.history[metric] ?? [];
    }

    clear() {
        this.history = {};
    }

    summary() {
        return Object.fromEntries(Object.entries(this.history).map(([metric, values]) => {
            const latest = values[values.length - 1];
            const isMin = metric.includes('loss') || metric.includes('error');
            const best = values.reduce((acc, v) => (isMin ? v.value < acc.value : v.value > acc.value) ? v : acc);
            return [metric, {latest: latest.value, best: best.value, bestEpoch: best.epoch}];
        }));
    }
}

// === Tier 3 Scaffolds (inline stubs) ===

export class SymbolicBackend {
    constructor() {
        throw new Error('SymbolicBackend not implemented');
    }
}

export class TensorOptimizer {
    constructor() {
        throw new Error('TensorOptimizer not implemented');
    }
}

export class ONNXExporter {
    constructor() {
        throw new Error('ONNXExporter not implemented');
    }
}
