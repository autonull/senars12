import { beforeEach, describe, expect, test } from '@jest/globals';
import { Tensor } from '@senars/tensor/src/Tensor.js';
import { NativeBackend } from '@senars/tensor/src/backends/NativeBackend.js';
import { checkUnaryGradient } from '../../support/tensorTestUtils.js';

describe('Tensor Gradients (Autograd)', () => {
  let backend;

  beforeEach(() => {
    backend = new NativeBackend();
  });

  describe('binary operations', () => {
    test('scalar multiplication gradient', () => {
      const a = new Tensor([2], { requiresGrad: true, backend });
      const b = new Tensor([3], { requiresGrad: true, backend });
      const c = backend.mul(a, b); // c = 6
      c.backward();

      // ∂c/∂a = b = 3, ∂c/∂b = a = 2
      expect(a.grad.data[0]).toBeCloseTo(3);
      expect(b.grad.data[0]).toBeCloseTo(2);
    });

    test('scalar addition gradient', () => {
      const a = new Tensor([5], { requiresGrad: true, backend });
      const b = new Tensor([10], { requiresGrad: true, backend });
      const c = backend.add(a, b); // c = 15
      c.backward();

      // ∂c/∂a = 1, ∂c/∂b = 1
      expect(a.grad.data[0]).toBeCloseTo(1);
      expect(b.grad.data[0]).toBeCloseTo(1);
    });

    test('scalar subtraction gradient', () => {
      const a = new Tensor([10], { requiresGrad: true, backend });
      const b = new Tensor([3], { requiresGrad: true, backend });
      const c = backend.sub(a, b); // c = 7
      c.backward();

      // ∂c/∂a = 1, ∂c/∂b = -1
      expect(a.grad.data[0]).toBeCloseTo(1);
      expect(b.grad.data[0]).toBeCloseTo(-1);
    });

    test('scalar division gradient', () => {
      const a = new Tensor([6], { requiresGrad: true, backend });
      const b = new Tensor([2], { requiresGrad: true, backend });
      const c = backend.div(a, b); // c = 3
      c.backward();

      // ∂c/∂a = 1/b = 0.5, ∂c/∂b = -a/b² = -1.5
      expect(a.grad.data[0]).toBeCloseTo(0.5);
      expect(b.grad.data[0]).toBeCloseTo(-1.5);
    });

    test('matrix multiplication gradient', () => {
      const W = new Tensor(
        [
          [1, 2],
          [3, 4],
        ],
        { requiresGrad: true, backend }
      );
      const x = new Tensor([[5], [6]], { requiresGrad: true, backend });
      const y = backend.matmul(W, x); // 2x1
      y.backward();

      // Check shapes
      expect(W.grad.shape).toEqual([2, 2]);
      expect(x.grad.shape).toEqual([2, 1]);

      // Check gradient values
      // ∂y/∂W = x^T (outer product with gradient)
      // Since grad(y) = [1, 1]^T and x = [5, 6]^T
      expect(W.grad.data[0]).toBeCloseTo(5); // [0,0]
      expect(W.grad.data[1]).toBeCloseTo(6); // [0,1]
      expect(W.grad.data[2]).toBeCloseTo(5); // [1,0]
      expect(W.grad.data[3]).toBeCloseTo(6); // [1,1]
    });
  });

  describe('activation gradients', () => {
    test('relu gradient mask', () => {
      const a = new Tensor([-1, 0, 1], { requiresGrad: true, backend });
      const b = backend.relu(a);
      b.backward();
      expect(a.grad.toArray()).toEqual([0, 0, 1]);
    });

    test('sigmoid gradient at zero', () => {
      const a = new Tensor([0], { requiresGrad: true, backend });
      const b = backend.sigmoid(a);
      b.backward();
      // σ'(0) = σ(0) * (1 - σ(0)) = 0.5 * 0.5 = 0.25
      expect(a.grad.data[0]).toBeCloseTo(0.25);
    });

    test('tanh gradient at zero', () => {
      const a = new Tensor([0], { requiresGrad: true, backend });
      const b = backend.tanh(a);
      b.backward();
      // tanh'(0) = 1 - tanh²(0) = 1 - 0 = 1
      expect(a.grad.data[0]).toBeCloseTo(1.0);
    });
  });

  describe('reduction gradients', () => {
    test('sum broadcasts gradient', () => {
      const a = new Tensor([1, 2, 3], { requiresGrad: true, backend });
      const b = backend.sum(a); // b = 6
      b.backward();
      expect(a.grad.toArray()).toEqual([1, 1, 1]);
    });

    test('mean divides gradient by size', () => {
      const a = new Tensor([2, 4, 6], { requiresGrad: true, backend });
      const b = backend.mean(a); // b = 4
      b.backward();
      // Gradient is divided by size: all elements get 1/3
      expect(a.grad.data[0]).toBeCloseTo(1 / 3);
      expect(a.grad.data[1]).toBeCloseTo(1 / 3);
      expect(a.grad.data[2]).toBeCloseTo(1 / 3);
    });
  });

  describe('numerical gradient checking', () => {
    test('verify analytical gradient with numerical (quadratic)', () => {
      // f(x) = x²
      // We can't use checkUnaryGradient directly because x^2 is mul(x,x)
      const eps = 1e-4;
      const x = new Tensor([2.0], { requiresGrad: true, backend });
      const y = backend.mul(x, x);
      y.backward();
      const analytical = x.grad.data[0];

      const xPlus = new Tensor([2.0 + eps], { backend });
      const xMinus = new Tensor([2.0 - eps], { backend });
      const fPlus = backend.mul(xPlus, xPlus).data[0];
      const fMinus = backend.mul(xMinus, xMinus).data[0];
      const numerical = (fPlus - fMinus) / (2 * eps);

      expect(analytical).toBeCloseTo(4.0, 5);
      expect(analytical).toBeCloseTo(numerical, 2);
    });

    test('numerical gradient for sigmoid', () => {
      const x = new Tensor([1.0], { requiresGrad: true, backend });
      const r = checkUnaryGradient(backend, backend.sigmoid, x);
      expect(r.analytical).toBeCloseTo(r.numerical, 2);
    });
  });

  describe('computation graph', () => {
    test('simple MLP forward and backward', () => {
      const x = new Tensor([[1, 2]], { backend });
      const W1 = new Tensor(
        [
          [0.1, 0.2],
          [0.3, 0.4],
        ],
        { requiresGrad: true, backend }
      );
      const W2 = new Tensor([[0.5], [0.6]], { requiresGrad: true, backend });

      // Forward: x -> W1 -> ReLU -> W2
      const h = backend.relu(backend.matmul(x, W1)); // 1x2
      const y = backend.matmul(h, W2); // 1x1

      y.backward();

      expect(W1.grad).not.toBeNull();
      expect(W1.grad.shape).toEqual([2, 2]);
      expect(W2.grad).not.toBeNull();
      expect(W2.grad.shape).toEqual([2, 1]);
    });

    test('gradient accumulation across multiple paths', () => {
      const x = new Tensor([3], { requiresGrad: true, backend });
      // y = x * x + x * 2
      const x_squared = backend.mul(x, x);
      const x_times_two = backend.mul(x, new Tensor([2], { backend }));
      const y = backend.add(x_squared, x_times_two);
      y.backward();
      // dy/dx = 2x + 2 = 8 at x=3
      expect(x.grad.data[0]).toBeCloseTo(8.0);
    });

    test('zeroGrad clears gradients', () => {
      const x = new Tensor([5], { requiresGrad: true, backend });
      const y = backend.mul(x, x);
      y.backward();
      expect(x.grad).not.toBeNull();
      x.zeroGrad();
      expect(x.grad).toBeNull();
    });
  });

  describe('training example', () => {
    test('simple linear regression converges', () => {
      // Data: y = 2x
      const X = new Tensor([[1], [2], [3], [4]], { backend });
      const y_true = new Tensor([[2], [4], [6], [8]], { backend });
      const W = new Tensor([[0.5]], { requiresGrad: true, backend });
      const lr = 0.05;

      for (let epoch = 0; epoch < 30; epoch++) {
        const y_pred = backend.matmul(X, W);
        const diff = backend.sub(y_pred, y_true);
        const squared = backend.mul(diff, diff);
        const loss = backend.mean(squared);

        W.zeroGrad();
        loss.backward();
        W.data[0] -= lr * W.grad.data[0];
      }
      expect(W.data[0]).toBeCloseTo(2.0, 1);
    });
  });
});
