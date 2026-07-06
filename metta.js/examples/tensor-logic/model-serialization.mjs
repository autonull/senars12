import {T} from '../../core/src/functor/backends/NativeBackend.js';
import {Linear, Module, Sequential} from '../../core/src/functor/Module.js';

console.log('=== Tensor Logic: Model Serialization ===\n');

class TinyMLP extends Module {
    constructor() {
        super();
        this.fc1 = this.registerModule('fc1', new Linear(4, 8));
        this.fc2 = this.registerModule('fc2', new Linear(8, 2));
    }

    forward(x) {
        return T.relu(this.fc2.forward(T.relu(this.fc1.forward(x))));
    }
}

const model = new TinyMLP();
console.log(`Created TinyMLP: ${model.parameters().length} params (4→8→2)\n`);

// Get state dict
const stateDict = model.stateDict();
console.log('\n--- State Dict Keys ---');
Object.keys(stateDict).forEach(key => {
    const data = stateDict[key];
    console.log(`  ${key}: [${data.slice(0, 3).map(v => v.toFixed(3)).join(', ')}...]`);
});

// Simulate "saving" (to JSON string)
const serialized = JSON.stringify(stateDict);
console.log(`\n--- Serialized (${serialized.length} bytes) ---`);
console.log(serialized.slice(0, 100) + '...');

// Create new model and load weights
const model2 = new TinyMLP();
console.log('\n--- Created Fresh Model ---');
console.log('fc1.weight[0] before load:', model2.fc1.weight.data.slice(0, 3).map(v => v.toFixed(3)).join(', '));

// Load state dict
const loaded = JSON.parse(serialized);
model2.loadStateDict(loaded);
console.log('fc1.weight[0] after load: ', model2.fc1.weight.data.slice(0, 3).map(v => v.toFixed(3)).join(', '));

// Verify outputs match
const testInput = T.randn([1, 4]);
const out1 = model.forward(testInput);
const out2 = model2.forward(testInput);

console.log('\n--- Verification ---');
console.log('Original output:', out1.toArray()[0].map(v => v.toFixed(4)).join(', '));
console.log('Loaded output:  ', out2.toArray()[0].map(v => v.toFixed(4)).join(', '));
console.log('Match:', JSON.stringify(out1.data) === JSON.stringify(out2.data) ? '✓' : '✗');

console.log(`\nTrain/eval modes: ${model.training} → ${model.eval().training} → ${model.train().training}`);

const seq = new Sequential(new Linear(2, 4), new Linear(4, 1));
console.log(`\nSequential: ${seq.parameters().length} params, keys: ${Object.keys(seq.stateDict()).join(', ')}`);

console.log('\n✅ Model serialization demo complete!');
