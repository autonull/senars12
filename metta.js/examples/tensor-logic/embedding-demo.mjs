// embedding-demo.mjs
import {T} from '../../core/src/functor/backends/NativeBackend.js';
import {Embedding, Linear, Module} from '../../core/src/functor/Module.js';
import {LossFunctor} from '../../core/src/functor/LossFunctor.js';
import {AdamOptimizer} from '../../core/src/functor/Optimizer.js';

console.log('=== Embedding Layer ===\n');

const embedding = new Embedding(10, 4);
console.log('Embedding table:', embedding.weight.shape, '→ [vocab_size, embedding_dim]');

const embedded = embedding.forward(T.tensor([0, 3, 7, 2]));
console.log('Embedded shape:', embedded.shape, '→ [4 words, 4 dims]');

console.log('\n--- Sentiment Classifier ---');

class SentimentClassifier extends Module {
    constructor() {
        super();
        this.embed = this.module('embed', new Embedding(6, 8));
        this.cls = this.module('cls', new Linear(8, 1));
    }

    forward(indices) {
        const emb = this.embed.forward(T.tensor(indices));
        return T.sigmoid(this.cls.forward(T.mean(emb, 0).reshape([1, 8])));
    }
}

const data = [
    {x: [3, 4], y: 1}, {x: [4, 5], y: 1},
    {x: [0, 1], y: 0}, {x: [1, 0], y: 0}
];

const model = new SentimentClassifier();
const loss_fn = new LossFunctor(T);
const optimizer = new AdamOptimizer(0.1);

for (let epoch = 0; epoch < 100; epoch++) {
    let totalLoss = 0;
    for (const {x, y} of data) {
        optimizer.zeroGrad(model.parameters());
        const pred = model.forward(x);
        const loss = loss_fn.binaryCrossEntropy(pred, T.tensor([[y]]));
        totalLoss += loss.data[0];
        loss.backward();
        optimizer.step(model.parameters());
    }
    if (epoch % 25 === 0) console.log(`Epoch ${epoch}: loss=${(totalLoss / data.length).toFixed(4)}`);
}

console.log('\n--- Predictions ---');
data.forEach(({x, y}) => {
    const pred = model.forward(x).data[0];
    console.log(`[${x}] → ${pred.toFixed(3)} (expected: ${y}) ${Math.round(pred) === y ? '✓' : '✗'}`);
});

const words = ['bad', 'terrible', 'ok', 'good', 'great', 'amazing'];
console.log('\n--- Learned Embeddings ---');
words.forEach((word, i) => {
    const vec = model.embed.forward(T.tensor([i])).toArray()[0];
    console.log(`${word.padEnd(10)}: [${vec.slice(0, 4).map(v => v.toFixed(2)).join(', ')}...]`);
});

const simGoodGreat = T.cosineSimilarity(
    model.embed.forward(T.tensor([3])),
    model.embed.forward(T.tensor([4]))
);
const simGoodBad = T.cosineSimilarity(
    model.embed.forward(T.tensor([3])),
    model.embed.forward(T.tensor([0]))
);
console.log(`\nSimilarity(good, great): ${simGoodGreat.data[0].toFixed(3)}`);
console.log(`Similarity(good, bad):   ${simGoodBad.data[0].toFixed(3)}`);

console.log('\n✅ Embedding complete!');
