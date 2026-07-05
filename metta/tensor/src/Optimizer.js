export class Optimizer {
    constructor(lr = 0.01) {
        this.lr = lr;
    }

    step(params) {
        throw new Error('Not implemented');
    }

    zeroGrad(params) {
        params.forEach(p => p.zeroGrad());
    }

    _update(params, fn) {
        const entries = params instanceof Map ? params : params.entries();
        for (const [k, p] of entries) {
            if (p.requiresGrad && p.grad) {
                fn(k, p);
            }
        }
    }

    _state(map, key, size, val = 0) {
        if (!map.has(key)) {
            map.set(key, Array(size).fill(val));
        }
        return map.get(key);
    }
}

export class SGDOptimizer extends Optimizer {
    constructor(lr = 0.01, momentum = 0) {
        super(lr);
        this.momentum = momentum;
        this.velocities = new Map();
    }

    step(params) {
        this._update(params, (k, p) => {
            const g = p.grad.data;
            if (this.momentum > 0) {
                const v = this._state(this.velocities, k, p.size);
                for (let i = 0; i < p.size; i++) {
                    v[i] = this.momentum * v[i] + g[i];
                    p.data[i] -= this.lr * v[i];
                }
            } else {
                for (let i = 0; i < p.size; i++) {
                    p.data[i] -= this.lr * g[i];
                }
            }
        });
    }
}

export class AdamOptimizer extends Optimizer {
    constructor(lr = 0.001, beta1 = 0.9, beta2 = 0.999, eps = 1e-8) {
        super(lr);
        Object.assign(this, {beta1, beta2, eps, m: new Map(), v: new Map(), t: 0});
    }

    step(params) {
        this.t++;
        const bc1 = 1 - Math.pow(this.beta1, this.t);
        const bc2 = 1 - Math.pow(this.beta2, this.t);

        this._update(params, (k, p) => {
            const m = this._state(this.m, k, p.size);
            const v = this._state(this.v, k, p.size);
            const g = p.grad.data;

            for (let i = 0; i < p.size; i++) {
                m[i] = this.beta1 * m[i] + (1 - this.beta1) * g[i];
                v[i] = this.beta2 * v[i] + (1 - this.beta2) * g[i] * g[i];
                p.data[i] -= this.lr * (m[i] / bc1) / (Math.sqrt(v[i] / bc2) + this.eps);
            }
        });
    }
}

export class RMSpropOptimizer extends Optimizer {
    constructor(lr = 0.01, decay = 0.9, eps = 1e-8) {
        super(lr);
        Object.assign(this, {decay, eps, cache: new Map()});
    }

    step(params) {
        this._update(params, (k, p) => {
            const c = this._state(this.cache, k, p.size);
            const g = p.grad.data;
            for (let i = 0; i < p.size; i++) {
                c[i] = this.decay * c[i] + (1 - this.decay) * g[i] * g[i];
                p.data[i] -= this.lr * g[i] / (Math.sqrt(c[i]) + this.eps);
            }
        });
    }
}
