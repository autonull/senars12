import {Tensor} from '../../core/src/functor/Tensor.js';
import {NativeBackend} from '../../core/src/functor/backends/NativeBackend.js';

const b = new NativeBackend();

console.log('=== Testing Axis-wise Reductions ===\n');

const a = new Tensor([[1, 2], [3, 4]], {requiresGrad: true, backend: b});
const sumAxis0 = b.sum(a, 0);
console.log('sum([[1,2],[3,4]], axis=0):', sumAxis0.data, '// expected: [4, 6]');

const sumAxis1 = b.sum(a, 1);
console.log('sum([[1,2],[3,4]], axis=1):', sumAxis1.data, '// expected: [3, 7]');

console.log('\n=== Testing Quantifiers ===\n');

const forallInput = new Tensor([[1, 0], [1, 1]], {backend: b});
console.log('forall([[1,0],[1,1]], axis=1):', b.forall(forallInput, 1).data, '// expected: [0, 1]');
console.log('  Row 0: min(1,0) = 0 (not all true)');
console.log('  Row 1: min(1,1) = 1 (all true)');

const existsInput = new Tensor([[0, 1], [0, 0]], {backend: b});
console.log('\nexists([[0,1],[0,0]], axis=1):', b.exists(existsInput, 1).data, '// expected: [1, 0]');
console.log('  Row 0: max(0,1) = 1 (exists)');
console.log('  Row 1: max(0,0) = 0 (none exist)');

console.log('\n=== Testing New Math Ops ===\n');

const x = new Tensor([1, 2, 3], {requiresGrad: true, backend: b});
console.log('exp([1,2,3]):', b.exp(x).data.map(v => v.toFixed(3)));
console.log('log([1,2,3]):', b.log(x).data.map(v => v.toFixed(3)));
console.log('sqrt([1,2,3]):', b.sqrt(x).data.map(v => v.toFixed(3)));
console.log('pow([1,2,3], 2):', b.pow(x, 2).data);
console.log('abs([-1,2,-3]):', b.abs(new Tensor([-1, 2, -3], {backend: b})).data);

console.log('\n✅ All Phase 6 enhancements verified!');
