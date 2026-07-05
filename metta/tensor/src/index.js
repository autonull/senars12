import {Tensor} from './Tensor.js';
import {T} from './backends/NativeBackend.js';

// --- Static Methods ---
Tensor.zeros = (shape) => T.zeros(shape);
Tensor.ones = (shape) => T.ones(shape);
Tensor.randn = (shape, mean, std) => T.randn(shape, mean, std);
Tensor.full = (shape, val) => T.full(shape, val);
Tensor.fromArray = (arr) => new Tensor(arr, {backend: T});

// Standalone factory functions
export const randn = (shape, mean = 0, std = 1) => T.randn(shape, mean, std);

// --- Instance Methods ---
const OPS = [
    'matmul', 'add', 'sub', 'mul', 'div',
    'relu', 'sigmoid', 'tanh', 'softmax', 'gelu',
    'exp', 'log', 'sqrt', 'pow', 'abs',
    'sum', 'mean', 'std', 'max', 'min',
    'gather', 'clamp', 'slice', 'unsqueeze', 'flatten'
];

const VALID_OPS = OPS.filter(op => typeof T[op] === 'function');

VALID_OPS.forEach(op => {
    Tensor.prototype[op] = function (...args) {
        return (this.backend || T)[op](this, ...args);
    };
});

export * from './Tensor.js';
export * from './Optimizer.js';
export * from './LossFunctor.js';
export * from './Module.js';
export * from './TruthTensorBridge.js';
export * from './TensorFunctor.js';
export * from './SymbolicTensor.js';
export * from './TensorLogicBridge.js';
export * from './TrainingUtils.js';
export {T as torch};
export {TensorBackend} from './backends/TensorBackend.js';
export {NativeBackend, backend} from './backends/NativeBackend.js';
