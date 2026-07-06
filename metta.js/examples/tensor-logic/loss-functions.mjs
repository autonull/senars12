// loss-functions.mjs
import {Tensor} from '../../core/src/functor/Tensor.js';
import {T} from '../../core/src/functor/backends/NativeBackend.js';
import {LossFunctor} from '../../core/src/functor/LossFunctor.js';

const loss_fn = new LossFunctor(T);
console.log('=== Loss Functions ===\n');

const pred = new Tensor([2.5, 0.0, 2.1, 7.8], {backend: T, requiresGrad: true});
const target = new Tensor([3.0, -0.5, 2.0, 7.5], {backend: T});

console.log('MSE:', loss_fn.mse(pred, target).data[0].toFixed(4));
console.log('MAE:', loss_fn.mae(pred, target).data[0].toFixed(4));

const probs = new Tensor([0.9, 0.2, 0.8, 0.1], {backend: T});
const labels = new Tensor([1, 0, 1, 0], {backend: T});
console.log('\nBinary CE:', loss_fn.binaryCrossEntropy(probs, labels).data[0].toFixed(4));

const softmaxPred = new Tensor([0.7, 0.2, 0.1], {backend: T});
const oneHot = new Tensor([1, 0, 0], {backend: T});
console.log('Cross Entropy:', loss_fn.crossEntropy(softmaxPred, oneHot).data[0].toFixed(4));

console.log('\nLoss sensitivity (target=1.0):');
[0.1, 0.3, 0.5, 0.7, 0.9, 1.0].forEach(p => {
    const [mse, mae, bce] = [
        loss_fn.mse(T.tensor([p]), T.tensor([1])),
        loss_fn.mae(T.tensor([p]), T.tensor([1])),
        loss_fn.binaryCrossEntropy(T.tensor([p]), T.tensor([1]))
    ].map(l => l.data[0].toFixed(4));
    console.log(`  ${p.toFixed(1)}: MSE=${mse}, MAE=${mae}, BCE=${bce}`);
});

console.log('\n✅ Loss functions complete!');
