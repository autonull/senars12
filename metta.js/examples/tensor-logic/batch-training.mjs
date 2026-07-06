/**
 * Batch Training Demo — Vectorized batch processing for efficiency
 * Run: node examples/tensor-logic/batch-training.mjs
 */
import {T} from '../../core/src/functor/backends/NativeBackend.js';
import {Linear} from '../../core/src/functor/Module.js';
import {LossFunctor} from '../../core/src/functor/LossFunctor.js';
import {AdamOptimizer} from '../../core/src/functor/Optimizer.js';
import {DataLoader} from '../../core/src/functor/TrainingUtils.js';

console.log('=== Tensor Logic: Batch Training ===\n');

// Generate synthetic dataset: y = 2x₁ + 3x₂ + noise
const createDataset = (n) => Array.from({length: n}, () => {
    const x1 = Math.random() * 2 - 1;
    const x2 = Math.random() * 2 - 1;
    return {
        x: [x1, x2],
        y: [2 * x1 + 3 * x2 + (Math.random() - 0.5) * 0.2]
    };
});

const trainData = createDataset(100);
const testData = createDataset(20);
console.log(`Training samples: ${trainData.length}, Test samples: ${testData.length}`);

// Collation function: converts batch of samples to tensors
const collateFn = (batch) => ({
    x: T.tensor(batch.map(s => s.x)),  // [batch, 2]
    y: T.tensor(batch.map(s => s.y))   // [batch, 1]
});

// DataLoader with batching
const batchSize = 16;
const trainLoader = new DataLoader(trainData, batchSize, true, collateFn);
console.log(`Batch size: ${batchSize}, Batches per epoch: ${Math.ceil(trainData.length / batchSize)}`);

// Model: Linear(2 → 1)
const model = new Linear(2, 1);
const loss_fn = new LossFunctor(T);
const optimizer = new AdamOptimizer(0.01);

console.log('\n--- Training with Batched Forward ---');

const epochs = 50;
for (let epoch = 0; epoch < epochs; epoch++) {
    let totalLoss = 0;
    let numBatches = 0;

    // Vectorized batch training
    for (const batch of trainLoader) {
        optimizer.zeroGrad(model.parameters());

        // Single forward pass for entire batch
        const pred = model.forward(batch.x);  // [batch, 1]
        const loss = loss_fn.mse(pred, batch.y);
        totalLoss += loss.data[0];
        numBatches++;

        loss.backward();
        optimizer.step(model.parameters());
    }

    if (epoch % 10 === 0 || epoch === epochs - 1) {
        console.log(`Epoch ${epoch.toString().padStart(2)}: loss = ${(totalLoss / numBatches).toFixed(4)}`);
    }
}

// Evaluate on test set (batched)
console.log('\n--- Batched Evaluation ---');
const testBatch = collateFn(testData);
const testPred = model.forward(testBatch.x);
const testLoss = loss_fn.mse(testPred, testBatch.y);
console.log(`Test loss (MSE): ${testLoss.data[0].toFixed(4)}`);

// Show learned weights (should be close to [2, 3])
console.log('\n--- Learned Parameters ---');
console.log(`Weight: [${model.weight.toArray().flat().map(v => v.toFixed(3)).join(', ')}] (target: [2, 3])`);
console.log(`Bias:   ${model.bias.data[0].toFixed(3)} (target: ~0)`);

// Compare sample-by-sample vs batched timing
console.log('\n--- Performance Comparison ---');

const measureTime = (fn, iters = 100) => {
    const start = performance.now();
    for (let i = 0; i < iters; i++) fn();
    return (performance.now() - start) / iters;
};

const sampleForward = () => {
    for (const s of trainData.slice(0, 16)) {
        model.forward(T.tensor([s.x]));
    }
};

const batchForward = () => {
    model.forward(collateFn(trainData.slice(0, 16)).x);
};

const sampleTime = measureTime(sampleForward, 50);
const batchTime = measureTime(batchForward, 50);

console.log(`Sample-by-sample: ${sampleTime.toFixed(3)}ms`);
console.log(`Batched:          ${batchTime.toFixed(3)}ms`);
console.log(`Speedup:          ${(sampleTime / batchTime).toFixed(1)}x`);

// Custom collation example
console.log('\n--- Custom Collation ---');

const padCollate = (batch, maxLen = 4) => {
    // Example: pad variable-length sequences
    const padded = batch.map(s => {
        const x = [...s.x];
        while (x.length < maxLen) x.push(0);
        return x.slice(0, maxLen);
    });
    return {x: T.tensor(padded), y: T.tensor(batch.map(s => s.y))};
};

const varLenData = [
    {x: [1, 2], y: [1]},
    {x: [3], y: [0]},
    {x: [4, 5, 6], y: [1]},
];

const paddedBatch = padCollate(varLenData);
console.log('Variable length inputs padded:');
paddedBatch.x.toArray().forEach((row, i) =>
    console.log(`  Sample ${i}: [${row.join(', ')}]`)
);

console.log('\n✅ Batch training demo complete!');
