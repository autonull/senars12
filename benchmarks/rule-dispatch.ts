#!/usr/bin/env tsx
/**
 * Standalone benchmark for rule dispatch performance
 * Run with: pnpm exec tsx benchmarks/rule-dispatch.ts
 */

import {atom, TermBuilder} from '../src';
import {RuleProcessor} from '../src';
import {Truth} from '../src';

const processor = new RuleProcessor();
const t1 = {term: TermBuilder.inheritance(atom('A'), atom('B')), truth: Truth.TRUE};
const t2 = {term: TermBuilder.inheritance(atom('B'), atom('C')), truth: Truth.TRUE};

console.log('SeNARS12 Rule Dispatch Benchmark');
console.log('================================\n');

const iterations = 10000;
const measurements: number[] = [];

// Multiple measurement runs
for (let run = 0; run < 5; run++) {
    // Warmup
    for (let i = 0; i < 500; i++) {
        processor.processSync(t1, t2);
    }

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        processor.processSync(t1, t2);
    }
    const elapsed = (performance.now() - start) * 1000;
    measurements.push(elapsed / iterations);
}

const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
const min = Math.min(...measurements);
const max = Math.max(...measurements);

console.log(`Iterations per run: ${iterations.toLocaleString()}`);
console.log(`Measurement runs: 5`);
console.log(`\nResults (μs per rule dispatch):`);
console.log(`  Min:    ${min.toFixed(3)} μs`);
console.log(`  Max:    ${max.toFixed(3)} μs`);
console.log(`  Average: ${avg.toFixed(3)} μs`);
console.log(`\nTarget: <10 μs`);
console.log(`Status: ${min < 10 ? '✅ PASS' : '❌ FAIL'}`);

if (max > 20) {
    console.log(`\n⚠️  Warning: High variance detected (${(max - min).toFixed(2)} μs range)`);
    console.log('   Run multiple times for stable measurements');
}

process.exit(min < 10 ? 0 : 1);
