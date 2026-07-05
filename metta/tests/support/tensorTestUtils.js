export function checkUnaryGradient(backend, fn, x, eps = 1e-6) {
    const bound = fn.bind(backend);
    const y = bound(x);
    y.backward();
    const analytical = x.grad.data[0];
    const xPlus = new x.constructor(x.data.map(v => v + eps), {backend});
    const xMinus = new x.constructor(x.data.map(v => v - eps), {backend});
    const fPlus = bound(xPlus).data[0];
    const fMinus = bound(xMinus).data[0];
    const numerical = (fPlus - fMinus) / (2 * eps);
    return {analytical, numerical};
}
