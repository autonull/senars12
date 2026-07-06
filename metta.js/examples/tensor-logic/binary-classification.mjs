/**
 * Binary Classification — Classify 2D points with decision boundary
 * Run: node examples/tensor-logic/binary-classification.mjs
 */
import {T} from '../../core/src/functor/backends/NativeBackend.js';
import {Linear, Module} from '../../core/src/functor/Module.js';
import {LossFunctor} from '../../core/src/functor/LossFunctor.js';
import {AdamOptimizer} from '../../core/src/functor/Optimizer.js';
import {createDataset, printMetrics, visualizeDecisionBoundary, visualizeGrid} from './utils/training_helpers.mjs';

console.log('=== Tensor Logic: Binary Classification ===\n');

const dataset = createDataset(i => {
    const label = i < 25 ? 0 : 1;
    const [cx, cy] = label === 0 ? [2, 2] : [5, 5];
    return {
        x: cx + Math.random() * 2,
        y: cy + Math.random() * 2,
        label
    };
}, 50).sort(() => Math.random() - 0.5);

console.log('--- Data Distribution ---');
visualizeGrid(dataset.map(d => ({x: d.x, y: d.y, label: d.label})));
console.log('○ = class 0, ● = class 1\n');

class Classifier extends Module {
    constructor() {
        super();
        this.fc1 = this.module('fc1', new Linear(2, 8));
        this.fc2 = this.module('fc2', new Linear(8, 1));
    }

    forward(x) {
        return T.sigmoid(this.fc2.forward(T.relu(this.fc1.forward(x))));
    }
}

const model = new Classifier();
const loss_fn = new LossFunctor(T);
const optimizer = new AdamOptimizer(0.1);

console.log('--- Training ---');
console.log('Architecture: Linear(2→8) → ReLU → Linear(8→1) → Sigmoid\n');

for (let epoch = 0; epoch < 100; epoch++) {
    let totalLoss = 0, correct = 0;

    dataset.forEach(({x, y, label}) => {
        optimizer.zeroGrad(model.parameters());
        const pred = model.forward(T.tensor([[x, y]]));
        const loss = loss_fn.binaryCrossEntropy(pred, T.tensor([[label]]));
        totalLoss += loss.item();
        if (Math.round(pred.data[0]) === label) correct++;
        loss.backward();
        optimizer.step(model.parameters());
    });

    if (epoch % 25 === 0 || epoch === 99) {
        printMetrics(epoch, {loss: totalLoss / dataset.length, acc: `${(correct / dataset.length * 100).toFixed(1)}%`});
    }
}

console.log('\n--- Decision Boundary ---');
visualizeDecisionBoundary(model, 40, 15, [0, 7], dataset.map(d => ({x: d.x, y: d.y, label: d.label})));
console.log('░ = predict 0, ▓ = predict 1');

const finalCorrect = dataset.reduce((acc, {x, y, label}) =>
    acc + (Math.round(model.forward(T.tensor([[x, y]])).data[0]) === label ? 1 : 0), 0);
console.log(`\nFinal Accuracy: ${(finalCorrect / dataset.length * 100).toFixed(1)}%`);
console.log('\n✅ Binary classification demo complete!');
