# Phase 6.6: Tensor Architecture Expansion

> **Goal**: Expand Tensor Logic from a functional prototype to a robust, accelerated, and interoperable ML framework.
> **Focus**: Architecture, Acceleration (WebGPU), and Ecosystem (ONNX).
> **Status**: Planning

---

## 1. Architectural Pillars

We will organize the expansion into five key architectural pillars.

### A. Backends (Acceleration)
*   **NativeBackend (CPU)**: Existing JS implementation. Reference implementation, debuggable, works everywhere.
*   **WebGPUBackend (GPU)**: **Primary Acceleration Target**.
    *   **Node.js**: Use `webgpu` (Dawn bindings) or `@kmamal/gpu` for headless server-side acceleration.
    *   **Browser**: Native WebGPU API.
    *   **Strategy**: Implement `TensorBackend` interface using WGSL compute shaders for `matmul`, `elementwise`, and `reduce`.
*   **WASMBackend (CPU++)**: Fallback for high-performance CPU usage where WebGPU is unavailable.

### B. Interoperability (Ecosystem)
*   **ONNX Export**:
    *   Implement `ONNXExporter` to serialize `Module` graphs to `.onnx` protobuf format.
    *   Enables deployment to edge devices, browsers (via onnxruntime-web), and other frameworks.
*   **Python Bridge**:
    *   `PythonBackend` that proxies operations to a local Python process (PyTorch/NumPy) via IPC/WebSocket.
    *   Allows using SeNARS logic with massive pre-trained PyTorch models without full porting.

### C. Core Layers (Deep Learning)
*   **Convolutional**: `Conv1d`, `Conv2d` (Vision, Audio).
    *   *Impl*: `im2col` based implementation for Native, optimized shader for WebGPU.
*   **Recurrent**: `RNN`, `LSTM`, `GRU` (Sequence Modeling).
    *   *Impl*: Unrolled loop for Native, custom kernels for WebGPU.
*   **Normalization**: `LayerNorm`, `BatchNorm`, `GroupNorm`.
*   **Pooling**: `MaxPool`, `AvgPool`.

### D. Data Pipeline (IO)
*   **DataLoader**:
    *   Batching, Shuffling, `collate_fn`.
    *   Async pre-fetching (using Workers in Node/Browser).
*   **Transforms**:
    *   Composable tensor transformations (Normalize, Resize, ToTensor).

### E. Neuro-Symbolic (Differentiation)
*   **Differentiable Logic**:
    *   `LogicLayer`: Tensor-based implementation of NAL logic rules (AND/OR/NOT as T-norms).
    *   Allows backpropagation *through* reasoning steps.
*   **Logic Regularization**:
    *   Loss terms derived from logical inconsistencies.

---

## 2. Implementation Strategy

### WebGPU Backend (Node.js & Browser)
*   **Library**: `webgpu` (npm) for Node.js (Dawn bindings).
*   **Shaders**: Write modular WGSL snippets for core ops.
    *   `matmul.wgsl`: Tiled matrix multiplication.
    *   `unary.wgsl`: Template for elementwise ops.
*   **Memory Management**: Explicit buffer management (`createBuffer`, `mapAsync`).
*   **Lazy Evaluation**: (Future) Build command buffers and execute only when needed.

### ONNX Exporter
*   **Protobuf**: Use `protobufjs` with ONNX `.proto` definition.
*   **Tracing**: Use `DerivationTracer` or a specialized `GraphTracer` to record `Module.forward` execution.
*   **Mapping**: Map SeNARS ops (`matmul`, `relu`) to ONNX operators (`MatMul`, `Relu`).

---

## 3. Prioritization

| Feature | Priority | Rationale |
|---------|----------|-----------|
| **WebGPU Backend** | 🔴 Critical | Essential for performance parity with PyTorch/TF.js. |
| **ONNX Export** | 🔴 Critical | Unlocks deployment and interoperability. |
| **Conv/LSTM** | 🟡 High | Required for non-trivial tasks (Vision/NLP). |
| **DataLoader** | 🟡 High | Required for training on real datasets. |
| **Python Bridge** | 🟢 Medium | Good fallback, but WebGPU is cleaner. |
| **Adv. Schedulers** | ⚪ Low | "Nice to have", can use simple decay for now. |
| **WASM Backend** | ⚪ Low | WebGPU covers most performance needs. |

---

## 4. Next Steps (Immediate)

1.  **Scaffold WebGPU**: Set up `WebGPUBackend` class and verify `webgpu` package in Node.
2.  **WGSL Matmul**: Implement and benchmark a simple matrix multiplication shader.
3.  **ONNX Proto**: Generate JS bindings for ONNX protobuf.
