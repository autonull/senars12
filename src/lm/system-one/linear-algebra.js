/**
 * Linear algebra utilities for head training.
 * Gaussian elimination with partial pivoting for ridge regression.
 */
/**
 * Gaussian elimination with partial pivoting (A square, nonsingular).
 * Solves A·x = b for x.
 */
export function solveLinearSystem(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
        let pivot = col;
        for (let r = col + 1; r < n; r++) {
            if (Math.abs(M[r][col]) > Math.abs(M[pivot][col]))
                pivot = r;
        }
        if (Math.abs(M[pivot][col]) < 1e-12)
            continue;
        [M[col], M[pivot]] = [M[pivot], M[col]];
        const p = M[col][col];
        for (let r = 0; r < n; r++) {
            if (r === col)
                continue;
            const factor = M[r][col] / p;
            if (factor === 0)
                continue;
            for (let c = col; c <= n; c++)
                M[r][c] -= factor * M[col][c];
        }
    }
    return M.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[n] / row[i]));
}
