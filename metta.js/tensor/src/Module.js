import {Tensor} from './Tensor.js';
import {T} from './backends/NativeBackend.js';

export class Module {
    constructor() {
        this._modules = new Map();
        this._parameters = new Map();
        this.training = true;
    }

    parameter(name, tensor) {
        if (!(tensor instanceof Tensor)) {
            throw new Error('parameter requires Tensor');
        }
        tensor.requiresGrad = true;
        this._parameters.set(name, tensor);
        return tensor;
    }

    module(name, module) {
        if (!(module instanceof Module)) {
            throw new Error('module requires Module');
        }
        this._modules.set(name, module);
        return module;
    }

    parameters() {
        return [...this._parameters.values(), ...Array.from(this._modules.values()).flatMap(m => m.parameters())];
    }

    namedParameters() {
        const params = new Map(this._parameters);
        for (const [k, m] of this._modules) {
            for (const [pk, pv] of m.namedParameters()) {
                params.set(`${k}.${pk}`, pv);
            }
        }
        return params;
    }

    to(backend) {
        this._parameters.forEach(p => p.backend = backend);
        this._modules.forEach(m => m.to(backend));
        if (this.backend) {
            this.backend = backend;
        }
        return this;
    }

    train(mode = true) {
        this.training = mode;
        this._modules.forEach(m => m.train(mode));
        return this;
    }

    eval() {
        return this.train(false);
    }

    inference() {
        return this.eval();
    }

    forward(...args) {
        throw new Error('forward() not implemented');
    }

    stateDict() {
        const dict = Object.fromEntries(Array.from(this._parameters, ([k, v]) => [k, v.data.slice()]));
        for (const [k, m] of this._modules) {
            Object.entries(m.stateDict()).forEach(([ck, cv]) => dict[`${k}.${ck}`] = cv);
        }
        return dict;
    }

    loadStateDict(dict) {
        this._parameters.forEach((v, k) => {
            if (dict[k]) {
                v.data = dict[k].slice();
            }
        });
        for (const [k, m] of this._modules) {
            const prefix = `${k}.`;
            const childDict = Object.fromEntries(
                Object.entries(dict).filter(([key]) => key.startsWith(prefix)).map(([key, val]) => [key.slice(prefix.length), val])
            );
            m.loadStateDict(childDict);
        }
    }
}

export class Linear extends Module {
    constructor(inFeatures, outFeatures, {backend = T, bias = true} = {}) {
        super();
        this.backend = backend;
        Object.assign(this, {inFeatures, outFeatures});
        this.weight = this.parameter('weight', backend.kaimingNormal([inFeatures, outFeatures]));
        this.bias = bias ? this.parameter('bias', backend.zeros([outFeatures])) : null;
    }

    forward(input) {
        let out = this.backend.matmul(input, this.weight);
        if (this.bias) {
            const bias = this.bias.ndim === 1 && out.ndim === 2
                ? this.backend.reshape(this.bias, [1, this.outFeatures])
                : this.bias;
            out = this.backend.add(out, bias);
        }
        return out;
    }
}

export class Embedding extends Module {
    constructor(numEmbeddings, embeddingDim, {backend = T} = {}) {
        super();
        this.backend = backend;
        Object.assign(this, {numEmbeddings, embeddingDim});
        this.weight = this.parameter('weight', backend.randn([numEmbeddings, embeddingDim]));
    }

    forward(input) {
        return this.backend.gather(this.weight, input);
    }
}

export class Sequential extends Module {
    constructor(...modules) {
        super();
        modules.forEach((m, i) => this.module(String(i), m));
        this.layers = modules;
    }

    forward(input) {
        return this.layers.reduce((x, layer) => layer.forward(x), input);
    }
}

export class MultiHeadAttention extends Module {
    constructor(dModel, numHeads, {backend = T} = {}) {
        super();
        if (dModel % numHeads) {
            throw new Error('dModel must be divisible by numHeads');
        }
        this.backend = backend;
        Object.assign(this, {dModel, numHeads, headDim: dModel / numHeads});
        ['qProj', 'kProj', 'vProj', 'outProj'].forEach(name =>
            this[name] = this.module(name, new Linear(dModel, dModel, {backend}))
        );
    }

    forward(input) {
        const [q, k, v] = ['qProj', 'kProj', 'vProj'].map(proj => this[proj].forward(input));
        return this.outProj.forward(this.backend.attention(q, k, v));
    }
}
