// truth-tensor-bridge.mjs
import {T} from '../../core/src/functor/backends/NativeBackend.js';
import {TruthTensorBridge} from '../../core/src/functor/TruthTensorBridge.js';

const bridge = new TruthTensorBridge(T);
console.log('=== Truth-Tensor Bridge ===\n');

const truth = {f: 0.8, c: 0.9};
console.log('scalar:', bridge.truthToTensor(truth, 'scalar').toArray());
console.log('bounds:', bridge.truthToTensor(truth, 'bounds').toArray().map(v => v.toFixed(3)));
console.log('vector:', bridge.truthToTensor(truth, 'vector').toArray().map(v => v.toFixed(3)));

console.log('\nsigmoid:', bridge.tensorToTruth(T.tensor([0.75]), 'sigmoid'));
console.log('dual:', bridge.tensorToTruth(T.tensor([0.8, 0.9]), 'dual'));
console.log('softmax:', bridge.tensorToTruth(T.tensor([0.1, 0.3, 0.9, 0.2]), 'softmax'));

console.log('\nExpectation:');
[{f: 1.0, c: 1.0}, {f: 0.0, c: 1.0}, {f: 0.5, c: 0.0}, {f: 0.8, c: 0.5}].forEach(t =>
    console.log(`  f=${t.f}, c=${t.c} → ${bridge.truthToExpectation(t).toFixed(3)}`)
);

const batchTruths = [{f: 0.9, c: 0.8}, {f: 0.1, c: 0.5}, {f: 0.6, c: 0.95}];
console.log('\nBatch (scalar):', bridge.truthsToTensor(batchTruths, 'scalar').toArray());
console.log('Batch (vector):', bridge.truthsToTensor(batchTruths, 'vector').shape);

const beliefEmbedding = bridge.truthsToTensor(batchTruths, 'vector');
const hidden = T.matmul(beliefEmbedding, T.randn([3, 4]));
console.log('\nProjected to hidden:', hidden.shape);

const t1 = bridge.truthToTensor({f: 0.9, c: 0.8}, 'vector');
const t2 = bridge.truthToTensor({f: 0.9, c: 0.3}, 'vector');
console.log('Similarity(high-conf, low-conf):', T.cosineSimilarity(t1, t2).data[0].toFixed(3));

console.log('\n✅ Truth-Tensor Bridge complete!');
