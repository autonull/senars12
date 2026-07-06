/**
 * bench-jit.mjs
 * MORK-parity Phase P5: JIT Compiler Benchmarks
 *
 * Measures hot-loop throughput before/after JIT compilation.
 * Target: >10× speedup on hot patterns after threshold reached.
 */

import {MeTTaInterpreter} from '../src/index.js';

export async function runJITBenchmark(iterations = 1000) {
    const results = {
        interpreterOnly: 0,
        jitEnabled: 0,
        speedup: 0
    };

    // Benchmark 1: Interpreter only (JIT disabled)
    {
        const interp = new MeTTaInterpreter({jit: false});

        // Load a hot-loop pattern
        interp.run(`
      (= (fib 0) 0)
      (= (fib 1) 1)
      (= (fib $n) (+ (fib (- $n 1)) (fib (- $n 2))))
    `);

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            interp.evaluate(interp.parser.parse('(fib 5)'));
        }
        results.interpreterOnly = performance.now() - start;
    }

    // Benchmark 2: JIT enabled
    {
        const interp = new MeTTaInterpreter({jit: true, jitThreshold: 10});

        interp.run(`
      (= (fib 0) 0)
      (= (fib 1) 1)
      (= (fib $n) (+ (fib (- $n 1)) (fib (- $n 2))))
    `);

        // Warm up JIT (trigger compilation)
        for (let i = 0; i < 20; i++) {
            interp.evaluate(interp.parser.parse('(fib 5)'));
        }

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            interp.evaluate(interp.parser.parse('(fib 5)'));
        }
        results.jitEnabled = performance.now() - start;
    }

    results.speedup = results.interpreterOnly / (results.jitEnabled || 1);

    return {
        name: 'JIT Compilation',
        iterations,
        ...results,
        unit: 'ms',
        pass: results.speedup >= 1.0 // JIT should not be slower
    };
}

/**
 * Benchmark: Arithmetic hot loop
 */
export async function runJITArithmeticBenchmark(iterations = 10000) {
    const results = {
        interpreterOnly: 0,
        jitEnabled: 0,
        speedup: 0
    };

    // Interpreter only
    {
        const interp = new MeTTaInterpreter({jit: false});

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            interp.evaluate(interp.parser.parse('(+ (* 3 4) (- 10 2))'));
        }
        results.interpreterOnly = performance.now() - start;
    }

    // JIT enabled
    {
        const interp = new MeTTaInterpreter({jit: true, jitThreshold: 5});

        // Warm up
        for (let i = 0; i < 10; i++) {
            interp.evaluate(interp.parser.parse('(+ (* 3 4) (- 10 2))'));
        }

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            interp.evaluate(interp.parser.parse('(+ (* 3 4) (- 10 2))'));
        }
        results.jitEnabled = performance.now() - start;
    }

    results.speedup = results.interpreterOnly / (results.jitEnabled || 1);

    return {
        name: 'JIT Arithmetic',
        iterations,
        ...results,
        unit: 'ms',
        pass: results.speedup >= 1.0
    };
}

/**
 * Benchmark: Pattern matching with rules
 */
export async function runJITPatternBenchmark(iterations = 5000) {
    const results = {
        interpreterOnly: 0,
        jitEnabled: 0,
        speedup: 0
    };

    const program = `
    (= (len ()) 0)
    (= (len ($h $t)) (+ 1 (len $t)))
  `;

    // Interpreter only
    {
        const interp = new MeTTaInterpreter({jit: false});
        interp.run(program);

        const list = interp.parser.parse('(a (b (c (d (e)))))');

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            interp.evaluate(list);
        }
        results.interpreterOnly = performance.now() - start;
    }

    // JIT enabled
    {
        const interp = new MeTTaInterpreter({jit: true, jitThreshold: 10});
        interp.run(program);

        const list = interp.parser.parse('(a (b (c (d (e)))))');

        // Warm up
        for (let i = 0; i < 15; i++) {
            interp.evaluate(list);
        }

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            interp.evaluate(list);
        }
        results.jitEnabled = performance.now() - start;
    }

    results.speedup = results.interpreterOnly / (results.jitEnabled || 1);

    return {
        name: 'JIT Pattern Matching',
        iterations,
        ...results,
        unit: 'ms',
        pass: results.speedup >= 1.0
    };
}

/**
 * Run all JIT benchmarks
 */
export async function runAllJITBenchmarks() {
    console.log('\n=== JIT Compiler Benchmarks ===\n');

    const results = [];

    results.push(await runJITBenchmark(500));
    results.push(await runJITArithmeticBenchmark(5000));
    results.push(await runJITPatternBenchmark(2000));

    for (const r of results) {
        console.log(`${r.name}:`);
        console.log(`  Interpreter: ${r.interpreterOnly.toFixed(2)}ms`);
        console.log(`  JIT:         ${r.jitEnabled.toFixed(2)}ms`);
        console.log(`  Speedup:     ${r.speedup.toFixed(2)}×`);
        console.log(`  Pass:        ${r.pass ? '✓' : '✗'}`);
        console.log();
    }

    const avgSpeedup = results.reduce((a, b) => a + b.speedup, 0) / results.length;
    console.log(`Average speedup: ${avgSpeedup.toFixed(2)}×`);

    return {results, avgSpeedup};
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllJITBenchmarks().catch(console.error);
}
