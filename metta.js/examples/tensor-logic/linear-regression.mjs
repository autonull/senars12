/**
 * Linear Regression — Learn y = mx + b with gradient descent
 * Run: node examples/tensor-logic/linear-regression.mjs
 */
import {T} from '../../core/src/functor/backends/NativeBackend.js';
import {Linear} from '../../core/src/functor/Module.js';
import {LossFunctor} from '../../core/src/functor/LossFunctor.js';
import {SGDOptimizer} from '../../core/src/functor/Optimizer.js';
import {MetricsTracker} from '../../core/src/functor/TrainingUtils.js';

console.log('=== Tensor Logic: Linear Regression ===\n');

// True parameters
const trueW = 2.5, trueB = -1.3;
const numSamples = 50;

// Generate synthetic data: y = 2.5x - 1.3 + noise
const data = Array.from({length: numSamples}, () => {
    const x = (Math.random() - 0.5) * 10;
    return {x, y: trueW * x + trueB + (Math.random() - 0.5) * 2};
});

const X = data.map(d => [d.x]);
const Y = data.map(d => [d.y]);

console.log(`True: y = ${trueW}x + ${trueB}, ${numSamples} samples\n`);

// ASCII scatter plot
console.log('--- Data Visualization (ASCII) ---');
const width = 50, height = 15;
const grid = Array(height).fill().map(() => Array(width).fill(' '));

const xMin = Math.min(...X.flat()), xMax = Math.max(...X.flat());
const yMin = Math.min(...Y.flat()), yMax = Math.max(...Y.flat());

X.forEach((x, i) => {
    const px = Math.floor((x[0] - xMin) / (xMax - xMin) * (width - 1));
    const py = height - 1 - Math.floor((Y[i][0] - yMin) / (yMax - yMin) * (height - 1));
    if (py >= 0 && py < height && px >= 0 && px < width) grid[py][px] = '•';
});

grid.forEach(row => console.log('│' + row.join('') + '│'));
console.log('└' + '─'.repeat(width) + '┘');

// Create model
const model = new Linear(1, 1);
const loss_fn = new LossFunctor(T);
const optimizer = new SGDOptimizer(0.01);
const tracker = new MetricsTracker();

console.log('\n--- Training ---');
console.log('Model: Linear(1 → 1)');
console.log('Optimizer: SGD(lr=0.01)');
console.log('Loss: MSE\n');

const epochs = 100;
for (let epoch = 0; epoch < epochs; epoch++) {
    let totalLoss = 0;

    for (let i = 0; i < numSamples; i++) {
        optimizer.zeroGrad(model.parameters());

        const x = T.tensor([X[i]]);
        const y = T.tensor([Y[i]]);

        const pred = model.forward(x);
        const loss = loss_fn.mse(pred, y);
        totalLoss += loss.data[0];

        loss.backward();
        optimizer.step(model.parameters());
    }

    const avgLoss = totalLoss / numSamples;
    tracker.log(epoch, {loss: avgLoss});

    if (epoch % 20 === 0 || epoch === epochs - 1) {
        const w = model.weight.data[0].toFixed(4);
        const b = model.bias.data[0].toFixed(4);
        console.log(`Epoch ${String(epoch).padStart(3)}: loss=${avgLoss.toFixed(4)}, w=${w}, b=${b}`);
    }
}

// Final results
console.log('\n--- Results ---');
const learnedW = model.weight.data[0];
const learnedB = model.bias.data[0];
console.log(`Learned: y = ${learnedW.toFixed(4)}x + ${learnedB.toFixed(4)}`);
console.log(`True:    y = ${trueW}x + ${trueB}`);
console.log(`Weight error: ${Math.abs(learnedW - trueW).toFixed(4)}`);
console.log(`Bias error:   ${Math.abs(learnedB - trueB).toFixed(4)}`);

// Draw learned line on plot
console.log('\n--- Learned Line (ASCII) ---');
const grid2 = Array(height).fill().map(() => Array(width).fill(' '));

// Draw data points
X.forEach((x, i) => {
    const px = Math.floor((x[0] - xMin) / (xMax - xMin) * (width - 1));
    const py = height - 1 - Math.floor((Y[i][0] - yMin) / (yMax - yMin) * (height - 1));
    if (py >= 0 && py < height && px >= 0 && px < width) grid2[py][px] = '•';
});

// Draw line
for (let px = 0; px < width; px++) {
    const x = xMin + (px / (width - 1)) * (xMax - xMin);
    const y = learnedW * x + learnedB;
    const py = height - 1 - Math.floor((y - yMin) / (yMax - yMin) * (height - 1));
    if (py >= 0 && py < height) grid2[py][px] = grid2[py][px] === '•' ? '⊕' : '─';
}

grid2.forEach(row => console.log('│' + row.join('') + '│'));
console.log('└' + '─'.repeat(width) + '┘');
console.log('• = data, ─ = learned line, ⊕ = overlap');

console.log('\n✅ Linear regression demo complete!');
