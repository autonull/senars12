# Tensor Logic Examples

Standalone examples demonstrating Tensor Logic capabilities **without NAL dependencies**.

## Quick Start

```bash
# Core functionality
node examples/tensor-logic/tensor-basics.mjs
node examples/tensor-logic/autograd-demo.mjs
node examples/tensor-logic/mlp-training.mjs

# Advanced features
node examples/tensor-logic/attention-mechanism.mjs
node examples/tensor-logic/training-utilities.mjs
node examples/tensor-logic/batch-training.mjs

# Neuro-symbolic integration (NEW)
node examples/tensor-logic/truth-tensor-bridge.mjs
node examples/tensor-logic/embedding-demo.mjs
node examples/tensor-logic/multi-head-attention.mjs

# Deep dives
node examples/tensor-logic/loss-functions.mjs
node examples/tensor-logic/optimizer-race.mjs
node examples/tensor-logic/activations.mjs
node examples/tensor-logic/gradient-check.mjs
node examples/tensor-logic/initialization.mjs

# End-to-end applications
node examples/tensor-logic/linear-regression.mjs
node examples/tensor-logic/binary-classification.mjs
node examples/tensor-logic/model-serialization.mjs
```

## Examples

### Core Functionality

#### [tensor-basics.mjs](./tensor-basics.mjs)

Introduction to Tensor primitives: creation, shapes, reshape, transpose, indexing, serialization.

#### [autograd-demo.mjs](./autograd-demo.mjs)

Automatic differentiation examples:

- `y = x²` gradient
- Chain rule: `y = (x+1)²`
- Multivariate: `z = x*y`
- Loss gradients
- ReLU gradient masking

#### [mlp-training.mjs](./mlp-training.mjs)

Train a Multi-Layer Perceptron on XOR:

- Build network with `Linear` layers
- Adam optimizer + binary cross-entropy loss
- Full training loop with convergence

### Advanced Features

#### [attention-mechanism.mjs](./attention-mechanism.mjs)

Self-attention and einsum:

- Scaled dot-product attention
- Einsum patterns (matmul, transpose, outer, trace)
- Cosine similarity

#### [training-utilities.mjs](./training-utilities.mjs)

Production training ergonomics:

- `DataLoader` with batching and shuffling
- `LRScheduler` (step, cosine, exponential)
- `EarlyStopping` for validation-based stopping
- `MetricsTracker` for logging
- Complete training run example

### Deep Dives

#### [loss-functions.mjs](./loss-functions.mjs)

Compare all loss functions:

- MSE, MAE for regression
- Binary cross-entropy for classification
- Cross-entropy for multi-class
- Loss sensitivity analysis

#### [optimizer-race.mjs](./optimizer-race.mjs)

Race different optimizers:

- SGD, SGD+Momentum, Adam, RMSprop
- Convergence comparison on `f(x) = (x-3)²`
- Optimizer characteristics explained

#### [activations.mjs](./activations.mjs)

Visual comparison of activation functions:

- ReLU, Sigmoid, Tanh, GELU
- Softmax with temperature scaling
- Gradient flow characteristics

#### [gradient-check.mjs](./gradient-check.mjs)

Verify autograd correctness:

- Numerical vs analytical gradients
- 15+ operations tested
- Matrix gradient verification

#### [initialization.mjs](./initialization.mjs)

Initialization strategies:

- Zeros, Random, Randn (Box-Muller)
- Xavier Uniform (tanh/sigmoid)
- Kaiming Normal (ReLU)
- Practical impact on training

### End-to-End Applications

#### [linear-regression.mjs](./linear-regression.mjs)

Classic linear regression:

- Synthetic data generation
- ASCII scatter plot visualization
- Learned line overlay
- Error analysis

#### [binary-classification.mjs](./binary-classification.mjs)

2D binary classification:

- Two cluster classification
- Decision boundary visualization
- MLP classifier training
- ASCII heatmap of predictions

#### [model-serialization.mjs](./model-serialization.mjs)

Save and load models:

- `stateDict()` / `loadStateDict()`
- JSON serialization
- Train/eval modes
- Sequential model state

## API Reference

See [core/src/functor/README.md](../../core/src/functor/README.md) for full API documentation.

| Module             | Description                                                             |
|--------------------|-------------------------------------------------------------------------|
| `Tensor.js`        | N-dimensional arrays with autograd                                      |
| `NativeBackend.js` | 50+ tensor operations (matmul, einsum, activations, etc.)               |
| `Module.js`        | PyTorch-like layers (Linear, Embedding, Sequential, MultiHeadAttention) |
| `Optimizer.js`     | SGD (momentum), Adam, RMSprop                                           |
| `LossFunctor.js`   | MSE, MAE, binary/cross-entropy                                          |
| `TrainingUtils.js` | DataLoader, LRScheduler, EarlyStopping, MetricsTracker                  |

## Coverage Map

```
tensor-basics.mjs         → Tensor core (shapes, reshape, transpose)
autograd-demo.mjs         → Autograd (backward, gradients, chain rule)
mlp-training.mjs          → Full training (Module, Loss, Optimizer)
attention-mechanism.mjs   → Einsum, attention, cosine similarity
training-utilities.mjs    → DataLoader, schedulers, metrics

loss-functions.mjs        → All 4 loss functions compared
optimizer-race.mjs        → All 4 optimizers compared
activations.mjs           → All 5 activations + softmax
gradient-check.mjs        → Numerical gradient verification
initialization.mjs        → All 3 init strategies

linear-regression.mjs     → Regression with visualization
binary-classification.mjs → Classification with decision boundary  
model-serialization.mjs   → Save/load weights

truth-tensor-bridge.mjs   → NAL truth ↔ tensor conversion (NEW)
embedding-demo.mjs        → Word embeddings, sentiment classifier (NEW)
multi-head-attention.mjs  → Transformer self-attention block (NEW)
batch-training.mjs        → Vectorized batch processing, 14x speedup (NEW)
```

## API Usage

All examples use the default `T` namespace - PyTorch-like ergonomics:

```javascript
import { T } from '../../core/src/functor/backends/NativeBackend.js';
import { Linear, Embedding } from '../../core/src/functor/Module.js';

// Create tensors via T factory
const x = T.tensor([[1, 2, 3]]);

// Layers use default backend automatically
const layer = new Linear(3, 4);  // No backend arg needed
const output = layer.forward(x);

// All ops via T namespace
const y = T.relu(T.matmul(x, T.randn([3, 4])));
```
