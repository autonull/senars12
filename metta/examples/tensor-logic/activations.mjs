// activations.mjs
import {Tensor} from '../../core/src/functor/Tensor.js';
import {T} from '../../core/src/functor/backends/NativeBackend.js';

console.log('=== Activation Functions ===\n');

const range = [-3, -2, -1, -0.5, 0, 0.5, 1, 2, 3];
const x = new Tensor(range, {backend: T, requiresGrad: true});

const activations = [
    ['ReLU', () => T.relu(x)],
    ['Sigmoid', () => T.sigmoid(x)],
    ['Tanh', () => T.tanh(x)],
    ['GELU', () => T.gelu(x)]
];

activations.forEach(([name, fn]) => {
    const result = fn();
    console.log(`${name.padEnd(8)}: ${result.toArray().map(v => v.toFixed(3).padStart(7)).join(' ')}`);
});

const logits = new Tensor([2.0, 1.0, 0.1], {backend: T});
console.log('\nSoftmax([2.0, 1.0, 0.1]):', T.softmax(logits).toArray().map(v => v.toFixed(3)).join(', '));

[0.5, 1.0, 2.0, 5.0].forEach(temp => {
    const scaled = T.softmax(T.div(logits, temp));
    console.log(`  T=${temp.toFixed(1)}: [${scaled.toArray().map(v => v.toFixed(3)).join(', ')}]`);
});

console.log('\nGradient characteristics:');
console.log('Point   ReLU    Sigmoid   Tanh');
[-2, 0, 2].forEach(val => {
    const grads = ['relu', 'sigmoid', 'tanh'].map(fn => {
        const xT = new Tensor([val], {requiresGrad: true, backend: T});
        T[fn](xT).backward();
        return xT.grad.data[0];
    });
    console.log(`${String(val).padStart(4)}    ${grads.map(g => g.toFixed(3).padStart(6)).join('  ')}`);
});

console.log('\n✅ Activations complete!');
