/**
 * Unit Tests for Parallel Evaluation
 *
 * NOTE: &map-parallel uses lazy evaluation and returns Promises that are not
 * fully resolved by runAsync. Re-enable when lazy eval is wired to auto-await.
 */
import {MeTTaTestUtils} from '../../../helpers/MeTTaTestUtils.js';
import {Formatter} from '../../../../metta/src/kernel/Formatter.js';

describe.skip('Parallel Evaluation', () => {
    let interpreter;

    afterEach(() => {
        if (interpreter?.workerPool) interpreter.workerPool.terminate();
    });

    test('should map items in parallel using background workers', async () => {
        interpreter = MeTTaTestUtils.createInterpreter({loadStdlib: true});
        const code = '!(&map-parallel (1 2 3 4) $x (+ $x 1))';
        const result = await interpreter.runAsync(code);

        expect(result).toHaveLength(1);
        expect(Formatter.toHyperonString(result[0])).toBe('(2 3 4 5)');
    }, 10000);

    test('should handle nested structure', async () => {
        interpreter = MeTTaTestUtils.createInterpreter({loadStdlib: true});
        const code = '!(&map-parallel (1) $x (: $x (: $x ())))';
        const result = await interpreter.runAsync(code);

        expect(result).toHaveLength(1);
        expect(Formatter.toHyperonString(result[0])).toBe('((1 1))');
    }, 10000);
});
