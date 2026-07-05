# Tensor Logic Module

A complete implementation of **Tensor Logic** (Domingos, 2025) - a unified framework for neuro-symbolic AI that treats
logical reasoning and neural operations as fundamentally the same using tensor mathematics.

## Overview

This module provides differentiable tensor operations integrated with SeNARS's symbolic reasoning, enabling:

- **Neural networks expressible as Prolog terms**
- **Automatic differentiation (autograd)** for end-to-end learning
- **Truth-value ↔ tensor conversions** for neuro-symbolic integration
- **Training loops** with gradient descent and adaptive optimizers

## Quick Start

### Creating and Operating on Tensors

```javascript
import { Tensor } from './Tensor.js';
import { NativeBackend } from './backends/NativeBackend.js';

const backend = new NativeBackend();

// Create tensors
const a = new Tensor([[1, 2], [3, 4]]);
const b = new Tensor([[5, 6], [7, 8]]);

// Matrix operations
const c = backend.matmul(a, b);
const d = backend.add(a, b);
const e = backend.relu(a);
```

### Using Autograd

```javascript
// Enable gradient tracking
const w = new Tensor([[0.5, 0.3]], { requiresGrad: true });
const x = new Tensor([1, 2]);

// Forward pass
const y = backend.matmul(w, x);

// Compute loss
const target = new Tensor([3]);
const loss = backend.sub(y, target);
const squared = backend.mul(loss, loss);

// Backward pass
squared.backward();
console.log(w.grad);  // Gradients computed!
```

### Training with Optimizers

```javascript
import { SGDOptimizer, AdamOptimizer } from './Optimizer.js';
import { LossFunctor } from './LossFunctor.js';

const lossFn = new LossFunctor(backend);
const optimizer = new AdamOptimizer(0.01);

// Training loop
for (let epoch = 0; epoch < 100; epoch++) {
    optimizer.zeroGrad(parameters);
    
    const pred = forwardPass(x, parameters);
    const loss = lossFn.mse(pred, target);
    
    loss.backward();
    optimizer.step(parameters);
}
```

### Truth-Value Integration

```javascript
import { TruthTensorBridge } from './TruthTensorBridge.js';

const bridge = new TruthTensorBridge(backend);

// NARS truth → tensor
const belief = { f: 0.8, c: 0.9 };
const tensor = bridge.truthToTensor(belief, 'vector');
// Returns: Tensor([0.8, 0.9, 0.77])

// Tensor → NARS truth
const output = new Tensor([0.7, 0.85]);
const truth = bridge.tensorToTruth(output, 'dual');
// Returns: { f: 0.7, c: 0.85 }
```

### Using in Prolog

```prolog
% Define a neural network
network(Input, Output) :-
    H is relu(add(matmul(w1, Input), b1)),
    Output is sigmoid(add(matmul(w2, H), b2)).

% Training step
train(Input, Target) :-
    network(Input, Pred),
    Loss is mse(Pred, Target),
    backward(Loss),
    W1_new is sgd_step(w1, 0.01),
    W2_new is sgd_step(w2, 0.01).

% Query
?- network([0.5, 0.3], Prediction).
```

## Core Components

### Tensor (`Tensor.js`)

N-dimensional array with optional gradient tracking.

**Key features**:

- Shape inference and manipulation (reshape, transpose)
- Automatic differentiation via `backward()`
- Serialization (toJSON, fromJSON)
- Memory-efficient flat storage

### Backends (`backends/`)

Abstract tensor operations for different computation engines.

**NativeBackend**: Pure JavaScript implementation

- Binary ops: add, sub, mul, div, matmul
- Activations: relu, sigmoid, tanh, gelu, softmax
- Reductions: sum, mean, max, min
- All operations support autograd

### TensorFunctor (`TensorFunctor.js`)

Evaluates tensor operations as Prolog terms.

**Integration with PrologStrategy**:

```javascript
const tensorFunctor = new TensorFunctor();
const strategy = new PrologStrategy({ tensorFunctor });
```

### TruthTensorBridge (`TruthTensorBridge.js`)

Bidirectional conversion between NARS truth values and tensors.

**Modes**:
| Mode | Truth → Tensor | Tensor → Truth |
|------|---------------|---------------|
| `scalar` | `[f]` | `{f, c: 0.9}` |
| `bounds` | `[f*c, f*c+(1-c)]` | N/A |
| `vector` | `[f, c, e]` | N/A |
| `dual` | N/A | `{f: t[0], c: t[1]}` |
| `softmax` | N/A | `{f: max(t), c: 1-1/(n+1)}` |

### LossFunctor (`LossFunctor.js`)

Differentiable loss functions with automatic gradients.

**Available losses**:

- `mse(pred, target)` - Mean Squared Error
- `mae(pred, target)` - Mean Absolute Error
- `binaryCrossEntropy(pred, target)` - Binary cross-entropy
- `crossEntropy(pred, target)` - Categorical cross-entropy

### Optimizers (`Optimizer.js`)

Parameter update algorithms for gradient descent.

**Optimizers**:

- `SGDOptimizer(lr, momentum)` - Stochastic Gradient Descent
- `AdamOptimizer(lr, beta1, beta2)` - Adaptive Moment Estimation
- `RMSpropOptimizer(lr, decay)` - RMSprop

## Architecture

```
┌──────────────────────┐
│  PrologStrategy      │
│  (uses tensorFunctor)│
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│   TensorFunctor      │
│  (term evaluation)   │
└──────┬───────────────┘
       │
   ┌───┴────┬──────────┬────────┐
   │        │          │        │
┌──▼──┐ ┌──▼──────┐ ┌─▼──────┐ ┌▼──────┐
│Tensor│ │Backend  │ │Bridge  │ │Loss   │
│      │ │(Native) │ │(Truth) │ │Functor│
└──┬───┘ └─────────┘ └────────┘ └───────┘
   │
Autograd
```

## Examples

See [`docs/examples/tensor_logic_layers.pl`](../../docs/examples/tensor_logic_layers.pl) for:

- Multi-layer perceptrons (MLPs)
- Batch normalization
- Residual blocks
- Attention mechanisms
- Training loop patterns

## Implementation Status

✅ **Phase 6 (Complete)**: Core Tensor Logic

- Forward operations, autograd, truth-tensor bridge, loss functions, optimizers

🔄 **Phase 6.5 (Planned)**: ~20 hrs (Platinum Optimized)

- **Tier 1**: Einsum, Composed Ops, Initialization, TensorFunctor Integration
- **Tier 2**: TrainingUtils.js, Module System (Layers, Sequential)
- **Tier 3**: Merged into Tier 2
- **Tier 4**: NAL integration (deferred)

## Testing

```bash
npm test -- tests/unit/functor/
```

**Coverage**: 690+ tests passing (98%)

## References

- [Tensor Logic: The Language of AI](https://arxiv.org/abs/2510.12269) (Domingos, 2025)
- [TODO.md Phase 6 & 6.5](../../TODO.md) - Full specification

