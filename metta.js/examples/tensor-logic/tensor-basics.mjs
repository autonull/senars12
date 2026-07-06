import {T} from '../../core/src/functor/backends/NativeBackend.js';

console.log('--- Tensor Basics ---');

// 1. Creation
const t1 = T.tensor([1, 2, 3, 4]);
const t2 = T.tensor([[1, 2], [3, 4]]);
const t3 = T.randn([2, 3]);

console.log('t1:', t1.toString());
console.log('t2:', t2.toString());
console.log('t3:', t3.toString());

// 2. Reshape & Transpose
const t4 = t1.reshape([2, 2]);
console.log('Reshaped t1:', t4.toString());

const t5 = t2.transpose();
console.log('Transposed t2:', t5.toString());

// 3. Operations
const t6 = T.add(t2, t5);
console.log('t2 + t2.T:', t6.toString());

const t7 = T.matmul(t2, t5);
console.log('t2 @ t2.T:', t7.toString());

// 4. Broadcasting
const t8 = T.tensor([[1, 2, 3], [4, 5, 6]]);
const t9 = T.tensor([1, 0, 1]);
const t10 = T.add(t8, t9);
console.log('Broadcasting add:', t10.toString());

// 5. Element access
console.log('t2[0, 1]:', t2.get([0, 1]));
t2.set([0, 1], 99);
console.log('Modified t2:', t2.toString());

// 6. Cloning
const t11 = t2.clone();
t11.set([0, 0], -1);
console.log('Original t2 (unchanged):', t2.toString());
console.log('Cloned t11:', t11.toString());

// 7. Serialization
const json = JSON.stringify(t2);
console.log('JSON:', json);
