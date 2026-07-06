/**
 * Simple Performance Benchmark for MeTTa Implementation
 * Runs basic performance tests without Jest
 */

import {MeTTaInterpreter} from '../src/index.js';

async function runBenchmark() {
    console.log('Starting MeTTa Performance Benchmark...');

    // Create interpreter without stdlib
    const interpreter = new MeTTaInterpreter({loadStdlib: false});

    console.log('\n1. Testing basic arithmetic performance...');
    const startArith = performance.now();
    for (let i = 0; i < 1000; i++) {
        const result = interpreter.run(`(^ &+ ${i} ${i + 1})`);
        if (parseInt(result[0].name) !== i + i + 1) {
            console.error(`Arithmetic test failed for ${i}`);
        }
    }
    const endArith = performance.now();
    console.log(`   1000 arithmetic operations: ${(endArith - startArith).toFixed(2)}ms`);

    console.log('\n2. Testing rule application performance...');
    // Add a simple rule
    interpreter.space.addRule(
        interpreter.parser.parse('(square $x)'),
        interpreter.parser.parse('(^ &* $x $x)')
    );

    const startRule = performance.now();
    for (let i = 1; i <= 100; i++) {
        const result = interpreter.run(`(square ${i})`);
        const expected = i * i;
        if (parseInt(result[0].name) !== expected) {
            console.error(`Rule test failed for ${i}, expected ${expected}, got ${result[0].name}`);
        }
    }
    const endRule = performance.now();
    console.log(`   100 rule applications: ${(endRule - startRule).toFixed(2)}ms`);

    console.log('\n3. Testing space operations...');
    const startSpace = performance.now();
    for (let i = 0; i < 1000; i++) {
        const atom = interpreter.parser.parse(`(benchmark-atom-${i} ${i * 2})`);
        interpreter.space.add(atom);
    }
    const endSpace = performance.now();
    console.log(`   Adding 1000 atoms to space: ${(endSpace - startSpace).toFixed(2)}ms`);
    console.log(`   Final space size: ${interpreter.space.size()}`);

    console.log('\n4. Testing simple reduction performance...');
    // Test a simple reduction that doesn't cause infinite loops
    interpreter.space.addRule(
        interpreter.parser.parse('(inc 0)'),
        interpreter.parser.parse('1')
    );
    interpreter.space.addRule(
        interpreter.parser.parse('(inc $n)'),
        interpreter.parser.parse('(^ &+ $n 1)')
    );

    const startReduction = performance.now();
    const result = interpreter.run('(inc 5)');
    const endReduction = performance.now();
    if (parseInt(result[0].name) !== 6) {
        console.error(`Reduction test failed, expected 6, got ${result[0].name}`);
    }
    console.log(`   Simple increment: ${(endReduction - startReduction).toFixed(2)}ms`);

    console.log('\n5. Testing list creation...');
    const startList = performance.now();
    for (let i = 0; i < 100; i++) {
        const result = interpreter.run(`(: ${i} ())`);
        if (!result[0]) {
            console.error(`List creation failed for ${i}`);
        }
    }
    const endList = performance.now();
    console.log(`   Creating 100 simple lists: ${(endList - startList).toFixed(2)}ms`);

    console.log('\n6. Testing complex expression evaluation...');
    // Create a moderately deep expression
    let expr = '0';
    for (let i = 1; i <= 10; i++) {
        expr = `(^ &+ ${i} ${expr})`;
    }

    const startComplex = performance.now();
    const complexResult = interpreter.run(expr);
    const endComplex = performance.now();
    const expectedSum = (10 * 11) / 2; // Sum of 1 to 10
    if (parseInt(complexResult[0].name) !== expectedSum) {
        console.error(`Complex expression failed, expected ${expectedSum}, got ${complexResult[0].name}`);
    }
    console.log(`   Complex expression (depth 10): ${(endComplex - startComplex).toFixed(2)}ms`);

    console.log('\nBenchmark completed successfully!');
    console.log('\nPerformance Summary:');
    console.log(`- Arithmetic: ${((endArith - startArith) / 1000).toFixed(4)}ms per operation`);
    console.log(`- Rule application: ${((endRule - startRule) / 100).toFixed(4)}ms per rule`);
    console.log(`- Space add: ${((endSpace - startSpace) / 1000).toFixed(4)}ms per atom`);
    console.log(`- Simple reduction: ${(endReduction - startReduction).toFixed(2)}ms`);
}

// Run the benchmark
runBenchmark().catch(console.error);