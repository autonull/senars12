import {Tensor} from '../../core/src/functor/Tensor.js';
import {T} from '../../core/src/functor/backends/NativeBackend.js';
import {AdamOptimizer, RMSpropOptimizer, SGDOptimizer} from '../../core/src/functor/Optimizer.js';

console.log('=== Tensor Logic: Optimizer Race ===\n');
console.log('Goal: Minimize f(x) = (x - 3)² starting from x = 10\n');

// Create optimizers
const optimizers = [
    {name: 'SGD', opt: new SGDOptimizer(0.1), color: '🔵'},
    {name: 'SGD+Mom', opt: new SGDOptimizer(0.1, 0.9), color: '🟢'},
    {name: 'Adam', opt: new AdamOptimizer(0.5), color: '🟡'},
    {name: 'RMSprop', opt: new RMSpropOptimizer(0.3), color: '🟠'}
];

const target = 3;
const maxIters = 20;

// Track trajectories
const trajectories = optimizers.map(({name, opt}) => {
    const x = new Tensor([10], {requiresGrad: true, backend: T});
    const params = new Map([['x', x]]);
    const history = [x.data[0]];

    for (let i = 0; i < maxIters; i++) {
        opt.zeroGrad(params);

        // f(x) = (x - 3)²
        const diff = T.sub(x, new Tensor([target], {backend: T}));
        const loss = T.mul(diff, diff);
        loss.backward();

        opt.step(params);
        history.push(x.data[0]);
    }

    return {name, history, final: x.data[0]};
});

// Print race results
console.log('Iteration   ' + trajectories.map(t => t.name.padEnd(10)).join(''));
console.log('─'.repeat(12 + trajectories.length * 10));

for (let i = 0; i <= maxIters; i += 4) {
    const row = trajectories.map(t => t.history[i].toFixed(4).padEnd(10)).join('');
    console.log(`${String(i).padStart(5)}       ${row}`);
}

console.log('\n--- Final Results ---');
trajectories.forEach(t => {
    const error = Math.abs(t.final - target);
    const stars = '★'.repeat(Math.max(0, 5 - Math.floor(error * 10)));
    console.log(`${t.name.padEnd(10)}: x = ${t.final.toFixed(6)} (error: ${error.toFixed(6)}) ${stars}`);
});

// Winner
const winner = trajectories.reduce((a, b) =>
    Math.abs(a.final - target) < Math.abs(b.final - target) ? a : b
);
console.log(`\n🏆 Winner: ${winner.name} with x = ${winner.final.toFixed(6)}`);

console.log('\n--- Optimizer Characteristics ---');
console.log('SGD:      Simple, steady, requires tuning');
console.log('SGD+Mom:  Momentum accelerates through flat regions');
console.log('Adam:     Adaptive LR, great default choice');
console.log('RMSprop:  Per-parameter adaptive, good for RNNs');

console.log('\n✅ Optimizer race complete!');
