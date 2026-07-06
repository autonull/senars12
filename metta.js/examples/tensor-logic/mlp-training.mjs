/**
 * MLP Training on XOR — Classic non-linear classification problem
 * Run: node examples/tensor-logic/mlp-training.mjs
 */
import {T} from '../../core/src/functor/backends/NativeBackend.js';
import {Linear, Module} from '../../core/src/functor/Module.js';
import {LossFunctor} from '../../core/src/functor/LossFunctor.js';
import {AdamOptimizer} from '../../core/src/functor/Optimizer.js';
import {printMetrics} from './utils/training_helpers.mjs';

console.log('=== Tensor Logic: MLP Training on XOR ===\n');

const dataset = [
    [[0, 0], 0], [[0, 1], 1], [[1, 0], 1], [[1, 1], 0]
].map(([x, y]) => ({input: T.tensor([x]), target: T.tensor([[y]])}));

console.log('XOR dataset:', dataset.map(d => `${d.input.numpy().flat()} → ${d.target.item()}`).join(', '));

class MLP extends Module {
    constructor() {
        super();
        this.fc1 = this.module('fc1', new Linear(2, 8));
        this.fc2 = this.module('fc2', new Linear(8, 1));
    }

    forward(x) {
        return T.sigmoid(this.fc2.forward(T.relu(this.fc1.forward(x))));
    }
}

const model = new MLP();
const loss_fn = new LossFunctor(T);
const optimizer = new AdamOptimizer(0.1);

console.log('Architecture: Linear(2→8) → ReLU → Linear(8→1) → Sigmoid\n');

for (let epoch = 0; epoch < 500; epoch++) {
    let totalLoss = 0;
    for (const {input, target} of dataset) {
        optimizer.zeroGrad(model.parameters());
        const loss = loss_fn.binaryCrossEntropy(model.forward(input), target);
        totalLoss += loss.item();
        loss.backward();
        optimizer.step(model.namedParameters());
    }
    if (epoch % 100 === 0 || epoch === 499) {
        printMetrics(epoch, {loss: totalLoss / dataset.length});
    }
}

console.log('\n--- Final Predictions ---');
dataset.forEach(({input, target}) => {
    const pred = model.forward(input).item();
    const match = Math.round(pred) === target.item() ? '✓' : '✗';
    console.log(`${input.numpy().flat()} → ${pred.toFixed(3)} (expected: ${target.item()}) ${match}`);
});

const accuracy = dataset.reduce((acc, {input, target}) =>
    acc + (Math.round(model.forward(input).item()) === target.item() ? 1 : 0), 0) / dataset.length;
console.log(`\nAccuracy: ${(accuracy * 100).toFixed(0)}%`);
