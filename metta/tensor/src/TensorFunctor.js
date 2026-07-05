import {Tensor} from './Tensor.js';
import {NativeBackend} from './backends/NativeBackend.js';
import {TruthTensorBridge} from './TruthTensorBridge.js';
import {LossFunctor} from './LossFunctor.js';
import {AdamOptimizer, SGDOptimizer} from './Optimizer.js';

export class TensorFunctor {
    static _TENSOR_OPS = new Set([
        'tensor', 'matmul', 'add', 'sub', 'mul', 'div', 'transpose', 'reshape', 'neg',
        'relu', 'sigmoid', 'tanh', 'softmax', 'gelu', 'sum', 'mean', 'max', 'min',
        'exp', 'log', 'sqrt', 'pow', 'abs', 'forall', 'exists',
        'zeros', 'ones', 'random', 'grad', 'backward', 'zero_grad',
        'truth_to_tensor', 'tensor_to_truth', 'mse', 'mae',
        'binary_cross_entropy', 'cross_entropy', 'sgd_step', 'adam_step'
    ]);

    constructor(backend = null) {
        this.backend = backend ?? new NativeBackend();
        this.bridge = new TruthTensorBridge(this.backend);
        this.loss = new LossFunctor(this.backend);
        this.ops = new Map();
        this._optimizers = new Map();
    }

    evaluate(term, bindings) {
        const op = term.operator ?? term.name;
        if (this.ops.has(op)) {
            const args = (term.components || []).map(c => this.resolve(c, bindings));
            return this.ops.get(op)(...args);
        }
        const binaryOps = ['matmul', 'add', 'sub', 'mul', 'div', 'pow'];
        const unaryOps = ['transpose', 'neg', 'relu', 'sigmoid', 'tanh', 'gelu', 'exp', 'log', 'sqrt', 'abs'];
        const reductionOps = ['sum', 'mean', 'max', 'min', 'forall', 'exists'];
        const shapeOps = ['zeros', 'ones', 'random'];

        switch (op) {
            case 'tensor':
                return this.createTensor(this.resolve(term.components[0], bindings));
            case 'reshape': {
                const tensor = this.resolve(term.components[0], bindings);
                const shape = this.resolve(term.components[1], bindings);
                return this.backend.reshape(tensor, Array.isArray(shape) ? shape : (shape.toArray?.() ?? [shape]));
            }
            case 'softmax': {
                const tensor = this.resolve(term.components[0], bindings);
                const axis = term.components[1] ? this.resolve(term.components[1], bindings) : -1;
                return this.backend.softmax(tensor, axis);
            }

            case 'grad': {
                const [output, input] = [0, 1].map(i => this.resolve(term.components[i], bindings));
                if (!(output instanceof Tensor) || !(input instanceof Tensor)) {
                    throw new Error('grad requires Tensor arguments');
                }
                if (!output.requiresGrad) {
                    throw new Error('Cannot compute gradient: output does not require gradients');
                }
                output.backward();
                return input.grad ?? this.backend.zeros(input.shape);
            }
            case 'backward': {
                const tensor = this.resolve(term.components[0], bindings);
                if (!(tensor instanceof Tensor)) {
                    throw new Error('backward requires Tensor');
                }
                tensor.backward();
                return tensor;
            }
            case 'zero_grad': {
                const tensor = this.resolve(term.components[0], bindings);
                if (!(tensor instanceof Tensor)) {
                    throw new Error('zero_grad requires Tensor');
                }
                tensor.zeroGrad();
                return tensor;
            }

            case 'truth_to_tensor': {
                const truth = this.resolve(term.components[0], bindings);
                const mode = term.components[1] ?
                    (this.resolve(term.components[1], bindings)?.value ?? this.resolve(term.components[1], bindings)) : 'scalar';
                return this.bridge.truthToTensor(truth, mode);
            }
            case 'tensor_to_truth': {
                const tensor = this.resolve(term.components[0], bindings);
                const mode = term.components[1] ?
                    (this.resolve(term.components[1], bindings)?.value ?? this.resolve(term.components[1], bindings)) : 'sigmoid';
                return this.bridge.tensorToTruth(tensor, mode);
            }

            case 'mse': {
                const pred = this.resolve(term.components[0], bindings);
                const target = this.resolve(term.components[1], bindings);
                return this.loss.mse(pred, target);
            }

            case 'mae': {
                const pred = this.resolve(term.components[0], bindings);
                const target = this.resolve(term.components[1], bindings);
                return this.loss.mae(pred, target);
            }

            case 'binary_cross_entropy': {
                const pred = this.resolve(term.components[0], bindings);
                const target = this.resolve(term.components[1], bindings);
                const eps = term.components[2] ? this.resolve(term.components[2], bindings) : 1e-7;
                return this.loss.binaryCrossEntropy(pred, target, eps);
            }

            case 'cross_entropy': {
                const pred = this.resolve(term.components[0], bindings);
                const target = this.resolve(term.components[1], bindings);
                const eps = term.components[2] ? this.resolve(term.components[2], bindings) : 1e-7;
                return this.loss.crossEntropy(pred, target, eps);
            }

            case 'sgd_step': {
                const param = this.resolve(term.components[0], bindings);
                const lr = this.resolve(term.components[1], bindings);
                const momentum = term.components[2] ? this.resolve(term.components[2], bindings) : 0;
                if (!(param instanceof Tensor)) {
                    throw new Error('sgd_step requires Tensor');
                }
                if (!param.grad) {
                    return param;
                }
                const optimizer = this._getOrCreateOptimizer('sgd', param, {lr, momentum});
                optimizer.step(new Map([['param', param]]));
                return param;
            }

            case 'adam_step': {
                const param = this.resolve(term.components[0], bindings);
                const lr = this.resolve(term.components[1], bindings);
                const beta1 = term.components[2] ? this.resolve(term.components[2], bindings) : 0.9;
                const beta2 = term.components[3] ? this.resolve(term.components[3], bindings) : 0.999;
                if (!(param instanceof Tensor)) {
                    throw new Error('adam_step requires Tensor');
                }
                if (!param.grad) {
                    return param;
                }
                const optimizer = this._getOrCreateOptimizer('adam', param, {lr, beta1, beta2});
                optimizer.step(new Map([['param', param]]));
                return param;
            }

            default:
                if (binaryOps.includes(op)) {
                    return this._callBinaryOp(op, term, bindings);
                }
                if (unaryOps.includes(op)) {
                    return this._callUnaryOp(op, term, bindings);
                }
                if (reductionOps.includes(op)) {
                    return this._callReductionOp(op, term, bindings);
                }
                if (shapeOps.includes(op)) {
                    return this._callShapeOp(op, term, bindings);
                }
                return term;
        }
    }

    resolve(term, bindings) {
        if (term instanceof Tensor) {
            return term;
        }
        if (typeof term === 'number') {
            return term;
        }
        if (Array.isArray(term)) {
            return term;
        }

        if (term?.isVariable) {
            const varName = term.name || term.toString();
            return bindings.has(varName) ? this.resolve(bindings.get(varName), bindings) : term;
        }

        if (term?.components) {
            return this.evaluate(term, bindings);
        }
        return term;
    }

    createTensor(data, options = {}) {
        if (data instanceof Tensor) {
            return data;
        }
        return new Tensor(data, {
            requiresGrad: options.requiresGrad ?? false,
            backend: this.backend
        });
    }

    _callBinaryOp(opName, term, bindings) {
        return this.backend[opName](
            this.resolve(term.components[0], bindings),
            this.resolve(term.components[1], bindings)
        );
    }

    _callUnaryOp(opName, term, bindings) {
        return this.backend[opName](this.resolve(term.components[0], bindings));
    }

    _callReductionOp(opName, term, bindings) {
        const tensor = this.resolve(term.components[0], bindings);
        const axis = term.components[1] ? this.resolve(term.components[1], bindings) : null;
        return this.backend[opName](tensor, axis);
    }

    _callShapeOp(opName, term, bindings) {
        const shape = this.resolve(term.components[0], bindings);
        return this.backend[opName](Array.isArray(shape) ? shape : [shape]);
    }

    registerOp(name, fn) {
        this.ops.set(name, fn);
    }

    registerModule(name, module) {
        this.registerOp(name, (...args) => module.forward(...args));
    }

    canEvaluate(term) {
        const op = term.operator ?? term.name;
        return this.ops.has(op) || TensorFunctor._TENSOR_OPS.has(op);
    }

    _getOrCreateOptimizer(type, param, config) {
        const key = `${type}:${param.data.byteOffset ?? param.data.toString().slice(0, 20)}`;
        if (!this._optimizers.has(key)) {
            this._optimizers.set(key, type === 'adam'
                ? new AdamOptimizer(config.lr, config.beta1, config.beta2)
                : new SGDOptimizer(config.lr, config.momentum));
        }
        return this._optimizers.get(key);
    }
}
