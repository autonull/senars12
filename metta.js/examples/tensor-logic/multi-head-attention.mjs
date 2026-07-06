/**
 * Multi-Head Attention Demo — Self-attention transformer block
 * Run: node examples/tensor-logic/multi-head-attention.mjs
 */
import {T} from '../../core/src/functor/backends/NativeBackend.js';
import {Linear, Module, MultiHeadAttention} from '../../core/src/functor/Module.js';

console.log('=== Tensor Logic: Multi-Head Attention ===\n');

// Create MHA: 8-dim model, 2 heads (4 dim per head)
const mha = new MultiHeadAttention(8, 2);
console.log(`MultiHeadAttention(d_model=${mha.dModel}, num_heads=${mha.numHeads})`);
console.log(`Head dimension: ${mha.headDim}`);

// Count parameters
const params = mha.parameters();
console.log(`Total parameters: ${params.reduce((sum, p) => sum + p.size, 0)}`);
console.log(`  - Q projection: ${mha.qProj.weight.size} + ${mha.qProj.bias.size}`);
console.log(`  - K projection: ${mha.kProj.weight.size} + ${mha.kProj.bias.size}`);
console.log(`  - V projection: ${mha.vProj.weight.size} + ${mha.vProj.bias.size}`);
console.log(`  - Output projection: ${mha.outProj.weight.size} + ${mha.outProj.bias.size}`);

// Self-attention on sequence
console.log('\n--- Self-Attention Forward Pass ---');
const seqLen = 3;
const input = T.randn([seqLen, 8]);
console.log(`Input shape: [${seqLen} tokens, 8 dims]`);

const output = mha.forward(input);
console.log(`Output shape: [${output.shape.join(', ')}]`);

// Manual attention computation for comparison
console.log('\n--- Manual Attention Breakdown ---');
const q = mha.qProj.forward(input);
const k = mha.kProj.forward(input);
const v = mha.vProj.forward(input);

console.log('Q, K, V shapes:', q.shape, k.shape, v.shape);

const scores = T.matmul(q, T.transpose(k));
console.log('Attention scores shape:', scores.shape, '→ [seq, seq]');

const scale = Math.sqrt(mha.dModel);
const weights = T.softmax(T.div(scores, scale), 1);
console.log('Attention weights (softmax):');
weights.toArray().forEach((row, i) =>
    console.log(`  Token ${i} attends to: [${row.map(v => v.toFixed(2)).join(', ')}]`)
);

// Train/eval mode
console.log('\n--- Train/Eval Mode ---');
console.log(`Training mode: ${mha.training}`);
mha.eval();
console.log(`After eval(): ${mha.training}`);
mha.train();
console.log(`After train(): ${mha.training}`);

// State dict for serialization
console.log('\n--- State Dict ---');
const state = mha.stateDict();
console.log('Keys:', Object.keys(state).slice(0, 4).join(', ') + '...');

// Simple transformer block example
console.log('\n--- Simple Transformer Block ---');

class TransformerBlock extends Module {
    constructor(dModel, numHeads) {
        super();
        this.backend = T;
        this.attn = this.registerModule('attn', new MultiHeadAttention(dModel, numHeads));
        this.ff = this.registerModule('ff', new Linear(dModel, dModel));
    }

    forward(x) {
        // Self-attention with residual
        const attended = T.add(x, this.attn.forward(x));
        // Feedforward with residual (simplified - no LayerNorm)
        return T.add(attended, T.relu(this.ff.forward(attended)));
    }
}

const block = new TransformerBlock(8, 2);
console.log(`TransformerBlock parameters: ${block.parameters().length}`);

const blockInput = T.randn([4, 8]);  // 4 tokens, 8 dims
const blockOutput = block.forward(blockInput);
console.log(`Block input: [${blockInput.shape.join(', ')}] → output: [${blockOutput.shape.join(', ')}]`);

console.log('\n✅ Multi-Head Attention demo complete!');
