// training-utilities.mjs
import {T} from '../../core/src/functor/backends/NativeBackend.js';
import {Linear} from '../../core/src/functor/Module.js';
import {LossFunctor} from '../../core/src/functor/LossFunctor.js';
import {SGDOptimizer} from '../../core/src/functor/Optimizer.js';
import {DataLoader, EarlyStopping, LRScheduler, MetricsTracker} from '../../core/src/functor/TrainingUtils.js';

console.log('=== Training Utilities ===\n');

const dataset = Array.from({length: 20}, (_, i) => ({
    x: T.tensor([[i * 0.1]]),
    y: T.tensor([[i * 0.2 + 1]])
}));

const loader = new DataLoader(dataset, 4, true);
console.log(`DataLoader: ${[...loader].length} batches (20 samples / batch_size=4)`);

console.log('\n--- LR Scheduler ---');
const dummyOpt = {lr: 0.1};
const stepScheduler = new LRScheduler(dummyOpt, 'step', 10, 0.5);
[0, 5, 10, 15, 20].forEach(epoch => {
    stepScheduler.step(epoch);
    console.log(`  Epoch ${epoch.toString().padStart(2)}: lr=${dummyOpt.lr.toFixed(4)}`);
});

dummyOpt.lr = 0.1;
const cosineScheduler = new LRScheduler(dummyOpt, 'cosine', 30, 0.1, 50);
console.log('\nCosine (max_epochs=50):');
[0, 12, 25, 37, 50].forEach(epoch => {
    cosineScheduler.step(epoch);
    console.log(`  Epoch ${epoch.toString().padStart(2)}: lr=${dummyOpt.lr.toFixed(4)}`);
});

console.log('\n--- Early Stopping ---');
const stopper = new EarlyStopping(3, 0.01);
[1.0, 0.8, 0.6, 0.59, 0.58, 0.58, 0.59, 0.60].forEach((loss, epoch) => {
    const shouldStop = stopper.step(loss);
    console.log(`Epoch ${epoch}: loss=${loss.toFixed(2)}, stop=${shouldStop}`);
});

console.log('\n--- Metrics Tracker ---');
const tracker = new MetricsTracker();
for (let epoch = 0; epoch < 5; epoch++) {
    tracker.log(epoch, {loss: 1.0 - epoch * 0.15, accuracy: 0.5 + epoch * 0.1});
}
console.log('Loss history:', tracker.get('loss').map(e => e.value.toFixed(2)).join(', '));
console.log('Accuracy history:', tracker.get('accuracy').map(e => e.value.toFixed(2)).join(', '));

console.log('\n--- Complete Training Run ---');
const model = new Linear(1, 1);
const loss_fn = new LossFunctor(T);
const optimizer = new SGDOptimizer(0.01, 0.9);
const scheduler = new LRScheduler(optimizer, 'step', 20, 0.5);
const early_stopping = new EarlyStopping(10, 0.0001);
const metrics = new MetricsTracker();

for (let epoch = 0; epoch < 100; epoch++) {
    let epochLoss = 0;
    for (const batch of new DataLoader(dataset, 4)) {
        optimizer.zeroGrad(model.parameters());
        const preds = batch.map(s => model.forward(s.x));
        const losses = batch.map((s, i) => loss_fn.mse(preds[i], s.y));
        const batchLoss = T.mean(T.stack(losses));
        epochLoss += batchLoss.data[0];
        batchLoss.backward();
        optimizer.step(model.parameters());
    }

    const avgLoss = epochLoss / [...new DataLoader(dataset, 4)].length;
    metrics.log(epoch, {loss: avgLoss, lr: optimizer.lr});
    scheduler.step(epoch);

    if (early_stopping.step(avgLoss)) {
        console.log(`Early stopping at epoch ${epoch}`);
        break;
    }
    if (epoch % 20 === 0) console.log(`Epoch ${epoch}: loss=${avgLoss.toFixed(6)}, lr=${optimizer.lr.toFixed(4)}`);
}

console.log(`\nFinal: w=${model.weight.data[0].toFixed(3)}, b=${model.bias.data[0].toFixed(3)} (expected: w≈0.2, b≈1.0)`);
console.log('\n✅ Training utilities complete!');
