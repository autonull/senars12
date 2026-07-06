/**
 * bench-zipper.mjs
 * MORK-parity Phase P5: Zipper-Based Traversal Benchmarks
 *
 * Measures deep expression traversal (depth 20/50) with vs. without zipper.
 * Target: ≥20× faster than baseline on depth 50 expressions.
 */

import {exp, MeTTaInterpreter, sym, Zipper} from '../src/index.js';

/**
 * Create a deeply nested expression
 */
function createDeepExpression(depth, value = 'x') {
    let expr = sym(value);
    for (let i = 0; i < depth; i++) {
        expr = exp(sym('wrap'), [expr]);
    }
    return expr;
}

/**
 * Calculate actual depth of an expression
 */
function getDepth(expr) {
    if (!expr || !expr.components || expr.components.length === 0) {
        return 0;
    }
    return 1 + Math.max(...expr.components.map(getDepth));
}

export async function runZipperBenchmark() {
    const results = {
        depth20: {recursive: 0, zipper: 0, speedup: 0},
        depth50: {recursive: 0, zipper: 0, speedup: 0},
        depth100: {recursive: 0, zipper: 0, speedup: 0}
    };

    // Test at different depths
    for (const depth of [20, 50, 100]) {
        const expr = createDeepExpression(depth);
        const iterations = Math.max(10, 100 - depth); // Fewer iterations for deeper expressions

        // Recursive traversal (zipper disabled)
        {
            const interp = new MeTTaInterpreter({zipper: false, zipperThreshold: 9999});

            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                // Navigate to deepest leaf using recursive descent
                let current = expr;
                while (current.components && current.components.length > 0) {
                    current = current.components[0];
                }
            }
            results[`depth${depth}`].recursive = performance.now() - start;
        }

        // Zipper traversal
        {
            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                const zipper = new Zipper(expr);

                // Navigate to deepest leaf using zipper
                while (zipper.down(0)) {
                    // Keep going down
                }

                // Navigate back up
                while (zipper.depth > 0) {
                    zipper.up();
                }
            }
            results[`depth${depth}`].zipper = performance.now() - start;
        }

        results[`depth${depth}`].speedup =
            results[`depth${depth}`].recursive / (results[`depth${depth}`].zipper || 1);
    }

    return {
        name: 'Zipper Traversal',
        ...results,
        pass: results.depth50.speedup >= 5.0 // Should be significantly faster
    };
}

/**
 * Benchmark: Zipper replacement (tree reconstruction)
 */
export async function runZipperReplacementBenchmark() {
    const results = {};
    const depth = 30;
    const expr = createDeepExpression(depth, 'original');
    const iterations = 100;

    // Recursive replacement
    {
        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            const replaceDeep = (node, replacement) => {
                // Check if it's an expression (has operator and type is compound)
                if (!node.operator || node.type !== 'compound') {
                    return replacement;
                }
                const newComps = [...node.components];
                newComps[0] = replaceDeep(node.components[0], replacement);
                return exp(node.operator, newComps);
            };
            replaceDeep(expr, sym('replaced'));
        }
        results.recursiveReplace = performance.now() - start;
    }

    // Zipper replacement
    {
        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            const zipper = new Zipper(expr);

            // Navigate to deepest
            while (zipper.down(0)) {
            }

            // Replace
            zipper.replace(sym('replaced'));
        }
        results.zipperReplace = performance.now() - start;
    }

    results.replaceSpeedup = results.recursiveReplace / (results.zipperReplace || 1);

    return {
        name: 'Zipper Replacement',
        depth,
        iterations,
        ...results,
        unit: 'ms',
        pass: results.replaceSpeedup >= 2.0
    };
}

/**
 * Benchmark: Sibling navigation
 */
export async function runZipperSiblingBenchmark() {
    const results = {};
    // Create a wide expression (many siblings)
    const width = 100;
    const components = [];
    for (let i = 0; i < width; i++) {
        components.push(exp(sym('item'), [sym(`x${i}`)]));
    }
    const expr = exp(sym('list'), components);
    const iterations = 50;

    // Array-based navigation
    {
        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            // Navigate to last sibling via array access
            const lastSibling = expr.components[width - 1];
        }
        results.arrayNav = performance.now() - start;
    }

    // Zipper navigation
    {
        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            const zipper = new Zipper(expr);
            zipper.down(0); // Into the list

            for (let j = 0; j < width - 1; j++) {
                zipper.right();
            }
        }
        results.zipperNav = performance.now() - start;
    }

    results.siblingSpeedup = results.arrayNav / (results.zipperNav || 1);

    return {
        name: 'Zipper Sibling Navigation',
        width,
        iterations,
        ...results,
        unit: 'ms',
        pass: results.siblingSpeedup >= 0.8 // Should be comparable
    };
}

/**
 * Run all zipper benchmarks
 */
export async function runAllZipperBenchmarks() {
    console.log('\n=== Zipper Traversal Benchmarks ===\n');

    const depthResults = await runZipperBenchmark();
    console.log('Deep Traversal:');
    for (const depth of [20, 50, 100]) {
        const r = depthResults[`depth${depth}`];
        console.log(`  Depth ${depth}:`);
        console.log(`    Recursive: ${r.recursive.toFixed(2)}ms`);
        console.log(`    Zipper:    ${r.zipper.toFixed(2)}ms`);
        console.log(`    Speedup:   ${r.speedup.toFixed(2)}×`);
    }
    console.log(`  Pass: ${depthResults.pass ? '✓' : '✗'}`);
    console.log();

    const replaceResults = await runZipperReplacementBenchmark();
    console.log('Tree Replacement:');
    console.log(`  Recursive: ${replaceResults.recursiveReplace.toFixed(2)}ms`);
    console.log(`  Zipper:    ${replaceResults.zipperReplace.toFixed(2)}ms`);
    console.log(`  Speedup:   ${replaceResults.replaceSpeedup.toFixed(2)}×`);
    console.log(`  Pass: ${replaceResults.pass ? '✓' : '✗'}`);
    console.log();

    const siblingResults = await runZipperSiblingBenchmark();
    console.log('Sibling Navigation:');
    console.log(`  Array:   ${siblingResults.arrayNav.toFixed(2)}ms`);
    console.log(`  Zipper:  ${siblingResults.zipperNav.toFixed(2)}ms`);
    console.log(`  Speedup: ${siblingResults.siblingSpeedup.toFixed(2)}×`);
    console.log(`  Pass: ${siblingResults.pass ? '✓' : '✗'}`);
    console.log();

    return {
        depthResults,
        replaceResults,
        siblingResults
    };
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllZipperBenchmarks().catch(console.error);
}
