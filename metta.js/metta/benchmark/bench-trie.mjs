/**
 * bench-trie.mjs
 * MORK-parity Phase P5: PathTrie Indexing Benchmarks
 *
 * Measures PathTrie vs. RuleIndex lookup speed on 10k/100k rules.
 * Target: <2× MORK PathMap latency, 10-30× speedup over linear scan.
 */

import {configManager, exp, PathTrie, Space, sym} from '../src/index.js';
import {RuleIndex} from '../src/kernel/RuleIndex.js';

/**
 * Generate a pattern with specific functor and arity
 */
function generatePattern(functor, arity, id) {
    const components = [];
    for (let i = 0; i < arity; i++) {
        components.push(sym(`arg${i}_${id}`));
    }
    return exp(sym(functor), components);
}

/**
 * Generate a query atom
 */
function generateQuery(functor, arity) {
    const components = [];
    for (let i = 0; i < arity; i++) {
        components.push(sym(`arg${i}`));
    }
    return exp(sym(functor), components);
}

/**
 * Benchmark: PathTrie vs. RuleIndex on rule lookups
 */
export async function runTrieBenchmark(ruleCounts = [1000, 10000]) {
    const results = [];

    for (const ruleCount of ruleCounts) {
        const functors = ['foo', 'bar', 'baz', 'qux', 'quux'];
        const arities = [1, 2, 3, 4];

        // Create space with PathTrie enabled
        const oldConfig = configManager.get('pathTrie;
        configManager.get('pathTrie = true;
        const spaceWithTrie = new Space();

        // Create space with RuleIndex only
        configManager.get('pathTrie = false;
        const spaceWithoutTrie = new Space();

        // Add rules
        for (let i = 0; i < ruleCount; i++) {
            const functor = functors[i % functors.length];
            const arity = arities[i % arities.length];
            const pattern = generatePattern(functor, arity, i);
            const result = sym(`result${i}`);

            spaceWithTrie.addRule(pattern, result);
            spaceWithoutTrie.addRule(pattern, result);
        }

        // Benchmark queries
        const queryCount = 1000;
        const queries = [];
        for (let i = 0; i < queryCount; i++) {
            const functor = functors[i % functors.length];
            const arity = arities[i % arities.length];
            queries.push(generateQuery(functor, arity));
        }

        // PathTrie lookup
        {
            const start = performance.now();
            for (const query of queries) {
                spaceWithTrie.rulesFor(query);
            }
            results.push({
                name: `PathTrie (${ruleCount} rules)`,
                ruleCount,
                queryCount,
                time: performance.now() - start,
                method: 'PathTrie'
            });
        }

        // RuleIndex lookup
        {
            const start = performance.now();
            for (const query of queries) {
                spaceWithoutTrie.rulesFor(query);
            }
            results.push({
                name: `RuleIndex (${ruleCount} rules)`,
                ruleCount,
                queryCount,
                time: performance.now() - start,
                method: 'RuleIndex'
            });
        }

        configManager.get('pathTrie = oldConfig;
    }

    return results;
}

/**
 * Benchmark: PathTrie insertion performance
 */
export async function runTrieInsertBenchmark() {
    const results = [];
    const insertCounts = [1000, 5000, 10000];

    for (const count of insertCounts) {
        const trie = new PathTrie();

        const start = performance.now();
        for (let i = 0; i < count; i++) {
            const pattern = generatePattern('test', 3, i);
            trie.insert(pattern, {id: i});
        }
        const time = performance.now() - start;

        results.push({
            name: `PathTrie Insert (${count})`,
            count,
            time,
            perInsert: time / count
        });
    }

    return results;
}

/**
 * Benchmark: PathTrie query with variables
 */
export async function runTrieVariableBenchmark() {
    const trie = new PathTrie();

    // Add rules with variables
    for (let i = 0; i < 1000; i++) {
        const pattern = exp(sym('rule'), [sym('$x'), sym('$y'), sym(`c${i}`)]);
        trie.insert(pattern, {id: i, hasVars: true});
    }

    // Add concrete rules
    for (let i = 0; i < 1000; i++) {
        const pattern = exp(sym('rule'), [sym(`a${i}`), sym(`b${i}`), sym(`c${i}`)]);
        trie.insert(pattern, {id: i + 1000, hasVars: false});
    }

    // Query with concrete values
    const query = exp(sym('rule'), [sym('a'), sym('b'), sym('c50')]);

    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        trie.query(query);
    }
    const time = performance.now() - start;

    return {
        name: 'PathTrie Variable Query',
        iterations,
        time,
        perQuery: time / iterations,
        stats: trie.stats
    };
}

/**
 * Benchmark: PathTrie rebalancing
 */
export async function runTrieRebalanceBenchmark() {
    const trie = new PathTrie();
    const insertBeforeRebalance = 10000;

    // Insert enough to trigger rebalance
    const start = performance.now();
    for (let i = 0; i < insertBeforeRebalance; i++) {
        const pattern = generatePattern('test', 2, i);
        trie.insert(pattern, {id: i});
    }
    const insertTime = performance.now() - start;

    // Wait for microtask rebalance
    await new Promise(resolve => setTimeout(resolve, 10));

    return {
        name: 'PathTrie Rebalance',
        inserts: insertBeforeRebalance,
        insertTime,
        rebalances: trie.stats.rebalances,
        stats: trie.stats
    };
}

/**
 * Run all trie benchmarks
 */
export async function runAllTrieBenchmarks() {
    console.log('\n=== PathTrie Indexing Benchmarks ===\n');

    // Main lookup comparison
    const lookupResults = await runTrieBenchmark([1000, 10000]);
    console.log('Rule Lookup Performance:');

    const grouped = {};
    for (const r of lookupResults) {
        if (!grouped[r.ruleCount]) grouped[r.ruleCount] = {};
        grouped[r.ruleCount][r.method] = r.time;
    }

    for (const [ruleCount, times] of Object.entries(grouped)) {
        const speedup = times.RuleIndex / (times.PathTrie || 1);
        console.log(`  ${ruleCount} rules:`);
        console.log(`    PathTrie:  ${times.PathTrie.toFixed(2)}ms`);
        console.log(`    RuleIndex: ${times.RuleIndex.toFixed(2)}ms`);
        console.log(`    Speedup:   ${speedup.toFixed(2)}×`);
    }
    console.log();

    // Insert performance
    const insertResults = await runTrieInsertBenchmark();
    console.log('Insertion Performance:');
    for (const r of insertResults) {
        console.log(`  ${r.count} inserts: ${r.time.toFixed(2)}ms (${r.perInsert.toFixed(4)}ms/insert)`);
    }
    console.log();

    // Variable query
    const varResults = await runTrieVariableBenchmark();
    console.log('Variable Query:');
    console.log(`  ${varResults.iterations} queries: ${varResults.time.toFixed(2)}ms`);
    console.log(`  Per query: ${varResults.perQuery.toFixed(4)}ms`);
    console.log();

    // Rebalance
    const rebalanceResults = await runTrieRebalanceBenchmark();
    console.log('Rebalancing:');
    console.log(`  ${rebalanceResults.inserts} inserts: ${rebalanceResults.insertTime.toFixed(2)}ms`);
    console.log(`  Rebalances triggered: ${rebalanceResults.rebalances}`);
    console.log();

    // Calculate overall speedup
    const avgSpeedup = Object.values(grouped).reduce((acc, t) => {
        return acc + (t.RuleIndex / (t.PathTrie || 1));
    }, 0) / Object.keys(grouped).length;

    console.log(`Average lookup speedup: ${avgSpeedup.toFixed(2)}×`);
    console.log(`Target (10-30×): ${avgSpeedup >= 10 ? '✓' : '○'} ${avgSpeedup >= 30 ? '✓' : ''}`);

    return {
        lookupResults,
        insertResults,
        varResults,
        rebalanceResults,
        avgSpeedup
    };
}
