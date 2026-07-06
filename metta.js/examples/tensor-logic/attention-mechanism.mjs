import {Tensor} from '../../core/src/functor/Tensor.js';
import {T} from '../../core/src/functor/backends/NativeBackend.js';

console.log('=== Tensor Logic: Attention Mechanism ===\n');

console.log('--- Einsum Patterns ---\n');

const a = new Tensor([[1, 2], [3, 4]], {backend: T}), b = new Tensor([[5, 6], [7, 8]], {backend: T});

const patterns = [
    ['ij,jk->ik', [a, b], 'matmul'],
    ['ij->ji', [a], 'transpose'],
    ['ij->i', [a], 'sum rows'],
    ['ij->j', [a], 'sum cols'],
    ['ii->', [a], 'trace'],
];

patterns.forEach(([pattern, tensors, desc]) => {
    const result = T.einsum(pattern, ...tensors);
    console.log(`einsum("${pattern}")`, Array.isArray(result.data) ? result.toArray() : result.data, `// ${desc}`);
});

const v1 = new Tensor([1, 2], {backend: T}), v2 = new Tensor([3, 4, 5], {backend: T});
const outer = T.einsum('i,j->ij', v1, v2);
console.log(`\neinsum("i,j->ij", [1,2], [3,4,5]):`, outer.toArray());

console.log('\n--- Scaled Dot-Product Attention ---\n');

const seqLen = 3, dModel = 4;
const Q = new Tensor([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]], {backend: T});
const K = new Tensor([[1, 0, 0, 0], [0, 0, 1, 0], [0, 1, 0, 0]], {backend: T});
const V = new Tensor([[10, 11, 12, 13], [20, 21, 22, 23], [30, 31, 32, 33]], {backend: T});

const scale = Math.sqrt(dModel);
const format = arr => arr.map(row => row.map(v => v.toFixed(1)).join(', ')).join('\n');

const attended = T.attention(Q, K, V);
console.log('Attended output (3 tokens, 4 dims):\n' + format(attended.toArray()));

console.log('\n--- Manual Attention Steps ---');
const scores = T.matmul(Q, T.transpose(K));
const weights = T.softmax(T.div(scores, scale), 1);
const output = T.matmul(weights, V);
console.log('Weights (softmax of Q@K^T / √d):\n' + weights.toArray().map(row => row.map(v => v.toFixed(3)).join(', ')).join('\n'));
console.log('\nOutput (weights @ V):\n' + format(output.toArray()));

console.log('\n--- Cosine Similarity ---');
const vec1 = new Tensor([1, 2, 3], {backend: T}), vec3 = new Tensor([-1, -2, -3], {backend: T});
console.log(`cos([1,2,3], [1,2,3]) = ${T.cosineSimilarity(vec1, vec1).data[0].toFixed(3)}`);
console.log(`cos([1,2,3], [-1,-2,-3]) = ${T.cosineSimilarity(vec1, vec3).data[0].toFixed(3)}`);

console.log('\n✅ Attention mechanism demo complete!');
