/**
 * Simple Performance Tests
 *
 * NOTE: These tests are timing-dependent and may fail on slower systems.
 * They are disabled by default. Run manually when needed.
 */

import {MeTTaInterpreter} from '../../src/index.js';

describe.skip('Simple Performance', () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new MeTTaInterpreter({loadStdlib: false});
    });

    test('basic arithmetic speed', () => {
        const start = performance.now();
        for (let i = 0; i < 100; i++) {
            interpreter.run(`(^ &+ ${i} 1)`);
        }
        const end = performance.now();
        expect(end - start).toBeLessThan(1000);
    });
});
