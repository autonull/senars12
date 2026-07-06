/**
 * bench-pln.mjs
 * MORK-parity Phase P5: Probabilistic Logic Network Benchmarks
 *
 * Measures PLN inference chain (Deduction+Revision+Intersection, 500 steps).
 * Target: Results match MORK reference ±0.01, <2× MORK PLN bench latency.
 */

import {exp, MeTTaInterpreter, sym} from '../src/index.js';

/**
 * Create a simple inheritance chain for PLN testing
 */
function createInheritanceChain(interpreter, chainLength) {
    let code = '';

    // Create a chain: A -> B -> C -> ... -> Target
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    for (let i = 0; i < chainLength; i++) {
        const from = letters[i];
        const to = letters[i + 1];
        code += `(= (inherits ${from}) ${to})\n`;
    }

    interpreter.run(code);
    return letters[0]; // Return start symbol
}

/**
 * Benchmark: Basic deduction chain
 */
export async function runDeductionChainBenchmark(steps = 500) {
    const interpreter = new MeTTaInterpreter();

    // Set up inheritance rules
    const code = `
    (= (implies A B) True)
    (= (implies B C) True)
    (= (implies C D) True)
    (= (implies D E) True)
    (= (implies E F) True)
    
    (= (deduce $x $y) (if (implies $x $y) $y))
  `;
    interpreter.run(code);

    const start = performance.now();

    // Chain deductions
    let current = sym('A');
    const targets = ['B', 'C', 'D', 'E', 'F'];

    for (let i = 0; i < steps; i++) {
        const targetIdx = i % targets.length;
        const target = sym(targets[targetIdx]);
        interpreter.evaluate(exp(sym('deduce'), [current, target]));
        current = target;
    }

    const time = performance.now() - start;

    return {
        name: 'Deduction Chain',
        steps,
        totalTime: time,
        avgTimePerStep: time / steps,
        stepsPerSecond: steps / (time / 1000)
    };
}

/**
 * Benchmark: Truth value revision
 */
export async function runRevisionBenchmark(iterations = 1000) {
    const interpreter = new MeTTaInterpreter();

    // Set up revision rules
    const code = `
    (= (rev-f1 $f1 $c1 $f2 $c2)
       (/ (+ (* $f1 $c1) (* $f2 $c2)) (+ $c1 $c2)))
    
    (= (rev-c1 $c1 $c2) (+ $c1 $c2))
    
    (= (revise ($f1 $c1) ($f2 $c2))
       ((rev-f1 $f1 $c1 $f2 $c2) (rev-c1 $c1 $c2)))
  `;
    interpreter.run(code);

    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
        const tv1 = interpreter.parser.parse('(0.8 10)');
        const tv2 = interpreter.parser.parse('(0.6 5)');
        interpreter.evaluate(exp(sym('revise'), [tv1, tv2]));
    }

    const time = performance.now() - start;

    return {
        name: 'Truth Revision',
        iterations,
        totalTime: time,
        avgTimePerRevision: time / iterations
    };
}

/**
 * Benchmark: Intersection (common property inference)
 */
export async function runIntersectionBenchmark(iterations = 500) {
    const interpreter = new MeTTaInterpreter();

    // Set up intersection rules
    const code = `
    (= (has-property Bird Fly) True)
    (= (has-property Bird Wings) True)
    (= (has-property Penguin Fly) False)
    (= (has-property Penguin Wings) True)
    (= (has-property Airplane Fly) True)
    (= (has-property Airplane Wings) True)
    
    (= (intersection $x $y)
       (find-common-properties $x $y))
  `;
    interpreter.run(code);

    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
        interpreter.evaluate(exp(sym('intersection'), [sym('Bird'), sym('Penguin')]));
    }

    const time = performance.now() - start;

    return {
        name: 'Property Intersection',
        iterations,
        totalTime: time,
        avgTimePerIntersection: time / iterations
    };
}

/**
 * Benchmark: Full PLN inference cycle
 */
export async function runFullPLNBenchmark(cycles = 100) {
    const interpreter = new MeTTaInterpreter();

    // Comprehensive PLN setup
    const code = `
    ; Inheritance rules
    (= (inherits Animal Mammal) True)
    (= (inherits Mammal Dog) True)
    (= (inherits Mammal Cat) True)
    (= (inherits Dog Pet) True)
    (= (inherits Cat Pet) True)
    
    ; Property rules
    (= (has-property Animal Breathes) True)
    (= (has-property Mammal WarmBlooded) True)
    (= (has-property Dog Loyal) True)
    (= (has-property Cat Independent) True)
    
    ; PLN deduction rule
    (= (pln-deduce $x $y $z)
       (if (and (inherits $x $y) (inherits $y $z))
           (inherits $x $z)))
    
    ; PLN induction rule
    (= (pln-induce $x $y $p)
       (if (and (has-property $x $p) (inherits $x $y))
           (has-property $y $p)))
    
    ; PLN abduction rule  
    (= (pln-abduce $x $y $p)
       (if (and (has-property $x $p) (has-property $y $p))
           (similar $x $y)))
  `;
    interpreter.run(code);

    const start = performance.now();
    const results = {
        deductions: 0,
        inductions: 0,
        abductions: 0
    };

    for (let i = 0; i < cycles; i++) {
        // Deduction
        const dedResult = interpreter.evaluate(
            exp(sym('pln-deduce'), [sym('Animal'), sym('Mammal'), sym('Dog')])
        );
        if (dedResult && dedResult.length > 0) results.deductions++;

        // Induction
        const indResult = interpreter.evaluate(
            exp(sym('pln-induce'), [sym('Dog'), sym('Mammal'), sym('Loyal')])
        );
        if (indResult && indResult.length > 0) results.inductions++;

        // Abduction
        const abdResult = interpreter.evaluate(
            exp(sym('pln-abduce'), [sym('Dog'), sym('Cat'), sym('Pet')])
        );
        if (abdResult && abdResult.length > 0) results.abductions++;
    }

    const time = performance.now() - start;

    return {
        name: 'Full PLN Cycle',
        cycles,
        totalTime: time,
        avgTimePerCycle: time / cycles,
        results,
        successRate: (results.deductions + results.inductions + results.abductions) / (cycles * 3)
    };
}

/**
 * Benchmark: Transitive closure
 */
export async function runTransitiveClosureBenchmark(depth = 50) {
    const interpreter = new MeTTaInterpreter();

    // Build a transitive chain
    let code = '';
    for (let i = 0; i < depth; i++) {
        code += `(= (link n${i} n${i + 1}) True)\n`;
    }

    // Transitive closure rule
    code += `
    (= (connected $x $y) (link $x $y))
    (= (connected $x $z) 
       (if (link $x $y) (connected $y $z)))
  `;

    interpreter.run(code);

    const start = performance.now();

    // Query transitive closure
    const result = interpreter.evaluate(
        exp(sym('connected'), [sym('n0'), sym(`n${depth}`)])
    );

    const time = performance.now() - start;

    return {
        name: 'Transitive Closure',
        depth,
        totalTime: time,
        foundPath: result && result.length > 0
    };
}

/**
 * Run all PLN benchmarks
 */
export async function runAllPLNBenchmarks() {
    console.log('\n=== PLN Inference Benchmarks ===\n');

    // Deduction chain
    console.log('Deduction Chain (500 steps):');
    const dedResults = await runDeductionChainBenchmark(500);
    console.log(`  Total time: ${dedResults.totalTime.toFixed(2)}ms`);
    console.log(`  Per step: ${dedResults.avgTimePerStep.toFixed(3)}ms`);
    console.log(`  Steps/sec: ${dedResults.stepsPerSecond.toFixed(1)}`);
    console.log();

    // Revision
    console.log('Truth Value Revision (1000 iterations):');
    const revResults = await runRevisionBenchmark(1000);
    console.log(`  Total time: ${revResults.totalTime.toFixed(2)}ms`);
    console.log(`  Per revision: ${revResults.avgTimePerRevision.toFixed(3)}ms`);
    console.log();

    // Intersection
    console.log('Property Intersection (500 iterations):');
    const intResults = await runIntersectionBenchmark(500);
    console.log(`  Total time: ${intResults.totalTime.toFixed(2)}ms`);
    console.log(`  Per intersection: ${intResults.avgTimePerIntersection.toFixed(3)}ms`);
    console.log();

    // Full PLN cycle
    console.log('Full PLN Cycle (100 cycles):');
    const plnResults = await runFullPLNBenchmark(100);
    console.log(`  Total time: ${plnResults.totalTime.toFixed(2)}ms`);
    console.log(`  Per cycle: ${plnResults.avgTimePerCycle.toFixed(3)}ms`);
    console.log(`  Deductions: ${plnResults.results.deductions}`);
    console.log(`  Inductions: ${plnResults.results.inductions}`);
    console.log(`  Abductions: ${plnResults.results.abductions}`);
    console.log(`  Success rate: ${(plnResults.successRate * 100).toFixed(1)}%`);
    console.log();

    // Transitive closure
    console.log('Transitive Closure:');
    const tcResults = await runTransitiveClosureBenchmark(50);
    console.log(`  Depth: ${tcResults.depth}`);
    console.log(`  Time: ${tcResults.totalTime.toFixed(2)}ms`);
    console.log(`  Path found: ${tcResults.foundPath ? '✓' : '✗'}`);
    console.log();

    return {
        dedResults,
        revResults,
        intResults,
        plnResults,
        tcResults
    };
}
