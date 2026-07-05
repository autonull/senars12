/**
 * bench-tensor.mjs
 * MORK-parity Phase P5: Tensor Operations Benchmarks
 *
 * Measures matmul, activations, backward pass performance.
 * Target: <5× PyTorch/WASM latency, XOR training ≥95% accuracy in ≤200 epochs.
 */

import {TensorFunctor} from '../tensor/src/TensorFunctor.js';
import {NativeBackend} from '../tensor/src/backends/NativeBackend.js';
import {AdamOptimizer} from '../tensor/src/Optimizer.js';
import {MSELoss} from '../tensor/src/LossFunctor.js';

/**
 * Benchmark: Matrix multiplication
 */
export async function runMatmulBenchmark(sizes = [[64, 64, 64], [128, 128, 128], [256, 256, 256]]) {
    const backend = new NativeBackend();
    const results = [];

    for (const [m, k, n] of sizes) {
        const a = backend.random(m, k);
        const b = backend.random(k, n);
        const iterations = 10;

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            backend.matmul(a, b, m, k, n);
        }
        const time = performance.now() - start;

        results.push({
            name: `matmul(${m}×${k}, ${k}×${n})`,
            m, k, n,
            iterations,
            totalTime: time,
            avgTime: time / iterations,
            gflops: (2 * m * k * n * iterations) / (time * 1e6)
        });
    }

    return results;
}

/**
 * Benchmark: Activation functions
 */
export async function runActivationBenchmark() {
    const backend = new NativeBackend();
    const sizes = [1000, 10000, 100000];
    const results = [];

    for (const size of sizes) {
        const x = backend.random(size, 1);
        const iterations = 100;

        // ReLU
        {
            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                backend.relu(x, size);
            }
            const time = performance.now() - start;
            results.push({name: `relu(${size})`, size, time: time / iterations});
        }

        // Sigmoid
        {
            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                backend.sigmoid(x, size);
            }
            const time = performance.now() - start;
            results.push({name: `sigmoid(${size})`, size, time: time / iterations});
        }

        // Softmax
        {
            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                backend.softmax(x, 0);
            }
            const time = performance.now() - start;
            results.push({name: `softmax(${size})`, size, time: time / iterations});
        }
    }

    return results;
}

/**
 * Benchmark: Backward pass (autograd)
 */
export async function runBackwardBenchmark() {
    const functor = new TensorFunctor();
    const results = [];

    // Simple network: W2 * relu(W1 * x + b1) + b2
    const testCases = [
        {input: 10, hidden: 20, output: 5},
        {input: 50, hidden: 100, output: 10},
        {input: 100, hidden: 200, output: 50}
    ];

    for (const tc of testCases) {
        const {input, hidden, output} = tc;
        const iterations = 10;

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            // Create tensors with requiresGrad
            const W1 = functor.evaluate({
                operator: 'tensor',
                components: [functor.evaluate({operator: 'random', components: [hidden, input]})]
            }, new Map());

            const b1 = functor.evaluate({
                operator: 'tensor',
                components: [functor.evaluate({operator: 'zeros', components: [hidden]})]
            }, new Map());

            const W2 = functor.evaluate({
                operator: 'tensor',
                components: [functor.evaluate({operator: 'random', components: [output, hidden]})]
            }, new Map());

            const b2 = functor.evaluate({
                operator: 'tensor',
                components: [functor.evaluate({operator: 'zeros', components: [output]})]
            }, new Map());

            const x = functor.evaluate({
                operator: 'tensor',
                components: [functor.evaluate({operator: 'random', components: [input]})]
            }, new Map());

            // Forward pass
            const h = functor.evaluate({
                operator: 'relu',
                components: [{
                    operator: 'add',
                    components: [
                        {operator: 'matmul', components: [W1, x]},
                        b1
                    ]
                }]
            }, new Map());

            const out = functor.evaluate({
                operator: 'add',
                components: [
                    {operator: 'matmul', components: [W2, h]},
                    b2
                ]
            }, new Map());

            // Backward pass
            functor.evaluate({operator: 'backward', components: [out]}, new Map());
        }
        const time = performance.now() - start;

        results.push({
            name: `backward(${input}→${hidden}→${output})`,
            ...tc,
            iterations,
            totalTime: time,
            avgTime: time / iterations
        });
    }

    return results;
}

/**
 * Benchmark: XOR training (end-to-end neural network)
 */
export async function runXORTrainingBenchmark(epochs = 200) {
    const backend = new NativeBackend();
    const functor = new TensorFunctor();
    const optimizer = new AdamOptimizer(0.01);

    // XOR training data
    const X = backend.tensor([
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1]
    ]);

    const y = backend.tensor([
        [0],
        [1],
        [1],
        [0]
    ]);

    // Initialize weights
    const W1 = backend.random(2, 4);
    const b1 = backend.zeros(4);
    const W2 = backend.random(4, 1);
    const b2 = backend.zeros(1);

    const lossFunctor = new MSELoss();
    const results = {epochs: [], losses: [], finalAccuracy: 0};

    const start = performance.now();

    for (let epoch = 0; epoch < epochs; epoch++) {
        // Forward pass
        const z1 = backend.add(backend.matmul(X, W1, 4, 2, 4), b1);
        const a1 = backend.relu(z1, 4);
        const z2 = backend.add(backend.matmul(a1, W2, 4, 4, 1), b2);
        const a2 = backend.sigmoid(z2, 1);

        // Loss
        const loss = lossFunctor.forward(a2, y);
        results.epochs.push(epoch);
        results.losses.push(loss);

        // Backward pass
        const dL = lossFunctor.backward(a2, y);
        const dz2 = backend.multiplyElementwise(dL, backend.sigmoidBackward(z2));
        const dW2 = backend.matmul(backend.transpose(a1, 4, 1), dz2, 1, 4, 1);
        const db2 = backend.sum(dz2, 4);

        const da1 = backend.matmul(dz2, backend.transpose(W2, 4, 1), 4, 1, 4);
        const dz1 = backend.multiplyElementwise(da1, backend.reluBackward(z1));
        const dW1 = backend.matmul(backend.transpose(X, 4, 2), dz1, 4, 4, 2);
        const db1 = backend.sum(dz1, 4);

        // Optimizer step
        optimizer.step(W1, dW1);
        optimizer.step(b1, db1);
        optimizer.step(W2, dW2);
        optimizer.step(b2, db2);

        // Check accuracy every 20 epochs
        if (epoch % 20 === 0 || epoch === epochs - 1) {
            const predictions = a2.map(v => v > 0.5 ? 1 : 0);
            const correct = predictions.filter((p, i) => p === y[i][0]).length;
            const accuracy = correct / 4;
            if (epoch === epochs - 1) {
                results.finalAccuracy = accuracy;
            }
        }
    }

    const totalTime = performance.now() - start;

    return {
        name: 'XOR Training',
        epochs,
        totalTime,
        avgTimePerEpoch: totalTime / epochs,
        finalLoss: results.losses[results.losses.length - 1],
        finalAccuracy: results.finalAccuracy,
        pass: results.finalAccuracy >= 0.95,
        lossHistory: results.losses
    };
}

/**
 * Benchmark: Tensor creation and operations
 */
export async function runTensorCreationBenchmark() {
    const functor = new TensorFunctor();
    const sizes = [100, 1000, 10000];
    const results = [];

    for (const size of sizes) {
        const iterations = 100;

        // Random tensor
        {
            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                functor.evaluate({
                    operator: 'random',
                    components: [size]
                }, new Map());
            }
            const time = performance.now() - start;
            results.push({name: `random(${size})`, size, time: time / iterations});
        }

        // Zeros tensor
        {
            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                functor.evaluate({
                    operator: 'zeros',
                    components: [size]
                }, new Map());
            }
            const time = performance.now() - start;
            results.push({name: `zeros(${size})`, size, time: time / iterations});
        }

        // Ones tensor
        {
            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                functor.evaluate({
                    operator: 'ones',
                    components: [size]
                }, new Map());
            }
            const time = performance.now() - start;
            results.push({name: `ones(${size})`, size, time: time / iterations});
        }
    }

    return results;
}

/**
 * Run all tensor benchmarks
 */
export async function runAllTensorBenchmarks() {
    console.log('\n=== Tensor Operations Benchmarks ===\n');

    // Matmul
    console.log('Matrix Multiplication:');
    const matmulResults = await runMatmulBenchmark();
    for (const r of matmulResults) {
        console.log(`  ${r.name}: ${r.avgTime.toFixed(3)}ms avg, ${r.gflops.toFixed(2)} GFLOPS`);
    }
    console.log();

    // Activations
    console.log('Activation Functions:');
    const activationResults = await runActivationBenchmark();
    for (const r of activationResults) {
        console.log(`  ${r.name}: ${r.time.toFixed(3)}ms avg`);
    }
    console.log();

    // Backward pass
    console.log('Backward Pass (Autograd):');
    const backwardResults = await runBackwardBenchmark();
    for (const r of backwardResults) {
        console.log(`  ${r.name}: ${r.avgTime.toFixed(3)}ms avg`);
    }
    console.log();

    // XOR Training
    console.log('XOR Training (200 epochs):');
    const xorResults = await runXORTrainingBenchmark(200);
    console.log(`  Total time: ${xorResults.totalTime.toFixed(2)}ms`);
    console.log(`  Time/epoch: ${xorResults.avgTimePerEpoch.toFixed(3)}ms`);
    console.log(`  Final loss: ${xorResults.finalLoss.toFixed(6)}`);
    console.log(`  Accuracy: ${(xorResults.finalAccuracy * 100).toFixed(1)}%`);
    console.log(`  Pass (≥95%): ${xorResults.pass ? '✓' : '✗'}`);
    console.log();

    // Tensor creation
    console.log('Tensor Creation:');
    const creationResults = await runTensorCreationBenchmark();
    for (const r of creationResults) {
        console.log(`  ${r.name}: ${r.time.toFixed(3)}ms avg`);
    }
    console.log();

    return {
        matmulResults,
        activationResults,
        backwardResults,
        xorResults,
        creationResults
    };
}
