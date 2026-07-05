import {bounce, Trampoline} from '../../../../metta/src/kernel/TCO.js';

describe('TCO (Tail Call Optimization)', () => {

    // Recursive function that blows stack without TCO
    const deepRecursion = (n, acc = 0) => {
        if (n <= 0) return acc;
        return bounce(deepRecursion, n - 1, acc + 1);
    };

    test('handles deep recursion without stack overflow', () => {
        const trampoline = new Trampoline();
        // 20000 usually blows stack in standard JS engines if not optimized
        const result = trampoline.run(deepRecursion, 20000);
        expect(result).toBe(20000);
    });

    test('handles normal non-recursive return', () => {
        const trampoline = new Trampoline();
        const simple = (x) => x * 2;
        const result = trampoline.run(simple, 21);
        expect(result).toBe(42);
    });
});
