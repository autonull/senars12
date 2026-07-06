// array-ops.mjs
import {Tensor} from '../../core/src/functor/Tensor.js';
import {T} from '../../core/src/functor/backends/NativeBackend.js';

console.log('=== Array Operations ===\n');

const a = new Tensor([[1, 2], [3, 4]], {backend: T});
const b = new Tensor([[5, 6], [7, 8]], {backend: T});

console.log('concat(axis=0):', T.concat([a, b], 0).toArray(), '→ shape:', T.concat([a, b], 0).shape);
console.log('concat(axis=1):', T.concat([a, b], 1).toArray(), '→ shape:', T.concat([a, b], 1).shape);

const big = new Tensor([[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]], {backend: T});
console.log('\nslice(3×4, [0:2], axis=0):', T.slice(big, 0, 2, 0).toArray());
console.log('slice(3×4, [1:3], axis=1):', T.slice(big, 1, 3, 1).toArray());

const embeddings = new Tensor([
    [1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0],
    [1.0, 1.0, 0.0], [0.0, 1.0, 1.0]
], {backend: T});

const indices = new Tensor([0, 2, 4, 1], {backend: T});
console.log('\ngather(5×3, [0,2,4,1]):', T.gather(embeddings, indices).toArray());

const flat = new Tensor([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], {backend: T});
console.log('\nreshape(12) → (3,4):', flat.reshape([3, 4]).toArray());
console.log('reshape(12) → (2,6):', flat.reshape([2, 6]).toArray());
console.log('reshape(12) → (2,2,3):', flat.reshape([2, 2, 3]).toArray());

const x = new Tensor([[1, 2]], {requiresGrad: true, backend: T});
const y = new Tensor([[3, 4]], {requiresGrad: true, backend: T});
const combined = T.concat([x, y], 0);
T.sum(combined).backward();

console.log('\nGradient flow: x.grad =', x.grad.toArray(), '| y.grad =', y.grad.toArray());
console.log('\n✅ Array operations complete!');
