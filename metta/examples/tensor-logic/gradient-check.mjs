import {Tensor} from '../../core/src/functor/Tensor.js';
import {T} from '../../core/src/functor/backends/NativeBackend.js';

console.log('=== Tensor Logic: Gradient Verification ===\n');

const eps = 1e-5;

function numericalGradient(fn, x, idx = 0) {
    const xPlus = new Tensor([...x.data], {backend: T});
    const xMinus = new Tensor([...x.data], {backend: T});
    xPlus.data[idx] += eps;
    xMinus.data[idx] -= eps;
    return (fn(xPlus).data[0] - fn(xMinus).data[0]) / (2 * eps);
}

function checkGradient(name, fn, xVal) {
    const x = new Tensor(xVal, {requiresGrad: true, backend: T});
    const y = fn(x);
    y.backward();

    const analytical = x.grad.toArray();
    const numerical = xVal.map((_, i) =>
        numericalGradient(t => fn(t), new Tensor(xVal, {backend: T}), i)
    );

    const maxError = Math.max(...analytical.map((a, i) => Math.abs(a - numerical[i])));
    const pass = maxError < 1e-4 ? '✓' : '✗';

    console.log(`${name}:`);
    console.log(`  Analytical: [${analytical.map(v => v.toFixed(6)).join(', ')}]`);
    console.log(`  Numerical:  [${numerical.map(v => v.toFixed(6)).join(', ')}]`);
    console.log(`  Max Error:  ${maxError.toExponential(2)} ${pass}\n`);

    return maxError < 1e-4;
}

// Test various operations
const tests = [
    ['y = x²', x => T.mul(x, x), [2, 3, 4]],
    ['y = x³', x => T.mul(T.mul(x, x), x), [2]],
    ['y = sum(x)', x => T.sum(x), [1, 2, 3, 4]],
    ['y = mean(x)', x => T.mean(x), [1, 2, 3, 4]],
    ['y = relu(x)', x => T.sum(T.relu(x)), [-1, 0, 1, 2]],
    ['y = sigmoid(x)', x => T.sum(T.sigmoid(x)), [-1, 0, 1]],
    ['y = tanh(x)', x => T.sum(T.tanh(x)), [-1, 0, 1]],
    ['y = exp(x)', x => T.sum(T.exp(x)), [0, 0.5, 1]],
    ['y = log(x)', x => T.sum(T.log(x)), [1, 2, 3]],
    ['y = sqrt(x)', x => T.sum(T.sqrt(x)), [1, 4, 9]],
    ['y = x + x', x => T.sum(T.add(x, x)), [1, 2, 3]],
    ['y = x - 1', x => T.sum(T.sub(x, T.ones([3]))), [1, 2, 3]],
    ['y = x / 2', x => T.sum(T.div(x, 2)), [2, 4, 6]],
    ['y = |x|', x => T.sum(T.abs(x)), [-2, 0, 2]],
    ['y = x^3', x => T.sum(T.pow(x, 3)), [1, 2]],
];

let passed = 0;
tests.forEach(([name, fn, xVal]) => {
    if (checkGradient(name, fn, xVal)) passed++;
});

console.log('─'.repeat(50));
console.log(`Results: ${passed}/${tests.length} gradient checks passed`);

// Matrix operations
console.log('\n--- Matrix Gradient Check ---');
const A = new Tensor([[1, 2], [3, 4]], {requiresGrad: true, backend: T});
const B = new Tensor([[5, 6], [7, 8]], {backend: T});

const C = T.matmul(A, B);
const loss = T.sum(C);
loss.backward();

console.log('A @ B then sum:');
console.log('  A.grad:', A.grad.toArray());
console.log('  Expected: [[11, 15], [11, 15]] (sum of B rows, broadcast)');

console.log('\n✅ Gradient verification complete!');
