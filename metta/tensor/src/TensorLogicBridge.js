import {Tensor} from './Tensor.js';
import {TensorFunctor} from './TensorFunctor.js';
import {SymbolicTensor, TensorOps} from './SymbolicTensor.js';
import {mergeConfig} from '@senars/core';

const DEFAULTS = {
    defaultSymbolThreshold: 0.5,
    defaultConfidence: 0.8,
    symbolGroundingFn: null,
    confidenceDecay: 0.9,
    minRuleConfidence: 0.7
};

const MergeOps = {
    union: (a, b) => `${a}∪${b}`,
    intersection: (a, b) => `${a}∩${b}`,
    concat: (a, b) => `${a}_${b}`
};

export class TensorLogicBridge {
    constructor(config = {}) {
        this.config = mergeConfig(DEFAULTS, config);
        this.functor = new TensorFunctor();
        this.symbolRegistry = new Map();
        this.groundingModel = null;
    }

    registerGrounding(name, fn) {
        this.symbolRegistry.set(name, fn);
        return this;
    }

    liftToSymbols(tensor, config = {}) {
        const {threshold = this.config.defaultSymbolThreshold, useAnnotations = true} = config;

        if (tensor instanceof SymbolicTensor && useAnnotations) {
            return tensor.projectToSymbols(threshold);
        }

        return Array.from(tensor.data)
            .map((value, i) => {
                if (Math.abs(value) >= threshold) {
                    return {
                        index: i,
                        symbol: `f${i}_${value > 0 ? 'pos' : 'neg'}`,
                        value,
                        confidence: this.config.defaultConfidence
                    };
                }
                return null;
            })
            .filter(Boolean);
    }

    groundToTensor(symbols, shape, config = {}) {
        const {aggregation = 'sum', defaultWeight = 1.0} = config;
        const data = new Float32Array(shape.reduce((a, b) => a * b, 1));

        symbols.forEach(sym => {
            const idx = typeof sym.index === 'number' ? sym.index : 0;
            const weight = sym.confidence !== undefined ? sym.confidence : defaultWeight;
            if (idx >= 0 && idx < data.length) {
                data[idx] += weight;
            }
        });

        const tensor = new SymbolicTensor(data, shape);
        tensor.addProvenance('groundToTensor', aggregation, {symbols: symbols.length});
        return tensor;
    }

    symbolicAdd(t1, t2, mergeFn = 'union') {
        if (!(t1 instanceof SymbolicTensor) || !(t2 instanceof SymbolicTensor)) {
            return this.functor.evaluate({operator: 'add', components: [t1, t2]}, new Map());
        }

        const result = new SymbolicTensor(
            new Float32Array(t1.data.map((v, i) => v + t2.data[i])),
            t1.shape
        );

        const allSymbols = new Set([...t1.symbols.keys(), ...t2.symbols.keys()]);

        allSymbols.forEach(key => {
            const s1 = t1.symbols.get(key);
            const s2 = t2.symbols.get(key);

            result.symbols.set(key, {
                symbol: this.mergeSymbols(s1?.symbol, s2?.symbol, mergeFn),
                confidence: s1 && s2 ? (s1.confidence + s2.confidence) / 2 : (s1 || s2)?.confidence,
                timestamp: Date.now()
            });
        });

        result.addProvenance('symbolicAdd', mergeFn, {t1, t2});
        return result;
    }

    mergeSymbols(s1, s2, mode) {
        if (!s1) {
            return s2;
        }
        if (!s2) {
            return s1;
        }
        return MergeOps[mode]?.(s1, s2) ?? s1;
    }

    symbolicMul(t1, t2, mergeFn = 'intersection') {
        if (!(t1 instanceof SymbolicTensor) || !(t2 instanceof SymbolicTensor)) {
            return this.functor.evaluate({operator: 'mul', components: [t1, t2]}, new Map());
        }

        const result = new SymbolicTensor(
            new Float32Array(t1.data.map((v, i) => v * t2.data[i])),
            t1.shape
        );

        t1.symbols.forEach((s1, key) => {
            const s2 = t2.symbols.get(key);
            if (s2) {
                result.symbols.set(key, {
                    symbol: this.mergeSymbols(s1.symbol, s2.symbol, mergeFn),
                    confidence: s1.confidence * s2.confidence,
                    timestamp: Date.now()
                });
            }
        });

        result.addProvenance('symbolicMul', mergeFn, {t1, t2});
        return result;
    }

    neuralOp(operation, tensor, ...args) {
        const result = this.functor.evaluate(
            {operator: operation, components: [tensor, ...args]},
            new Map()
        );

        const symbolicResult = result instanceof Tensor
            ? new SymbolicTensor(result.data, result.shape)
            : result;

        if (symbolicResult instanceof SymbolicTensor) {
            symbolicResult.addProvenance('neuralOp', operation, {args});

            tensor.symbols.forEach((symbol, key) => {
                symbolicResult.symbols.set(key, {
                    ...symbol,
                    confidence: symbol.confidence * this.config.confidenceDecay
                });
            });
        }

        return symbolicResult;
    }

    createAttentionMask(tensor, symbolMask) {
        const mask = TensorOps.makeMask(tensor.data.length, symbolMask, tensor.symbols);

        return new SymbolicTensor(mask, tensor.shape, {
            provenance: [{operation: 'attentionMask', timestamp: Date.now()}]
        });
    }

    symbolicSoftmax(tensor, symbolWeights = null) {
        const result = TensorOps.softmax(tensor.data, symbolWeights, tensor.shape);
        result.addProvenance('symbolicSoftmax', 'attention', {symbolWeights: !!symbolWeights});
        return result;
    }

    extractRules(tensor, minConfidence = this.config.minRuleConfidence) {
        return Array.from(tensor.symbols)
            .filter(([_, {confidence}]) => confidence >= minConfidence)
            .map(([key, {symbol, confidence}]) => {
                const idx = key.split(',').map(Number);
                const value = tensor.data[idx.reduce((a, b) => a * tensor.shape[b] + b, 0)];
                return {
                    antecedent: symbol,
                    consequent: value > 0 ? 'activate' : 'inhibit',
                    strength: confidence,
                    evidence: Math.abs(value)
                };
            });
    }

    serialize() {
        return {
            config: this.config,
            symbolRegistry: Array.from(this.symbolRegistry.entries()),
            version: '1.0.0'
        };
    }
}

export function termToTensor(term, shape, registry = new Map()) {
    const match = term.match(/\((\w+)_([\d x]+):\[(.*?)\]\)/);
    if (!match) {
        return null;
    }

    const [, _, shapeStr, content] = match;
    const dims = shapeStr.split('x').map(Number);
    const data = new Float32Array(dims.reduce((a, b) => a * b, 1));
    const tensor = new SymbolicTensor(data, dims);

    content.split(',').forEach(ann => {
        const [symbol, confidence] = ann.split(':');
        const idx = registry.get(symbol.trim()) || 0;
        tensor.annotate([idx], symbol.trim(), parseFloat(confidence) || 1.0);
    });

    return tensor;
}
