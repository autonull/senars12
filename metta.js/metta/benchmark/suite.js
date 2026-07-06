import {runComparison} from '../src/config.js';
import {Space, sym, symbolEq, Unify} from '../src/index.js';

export const BENCHMARKS = [
    {
        name: 'symbol-equality',
        code: () => {
            const a = sym('test');
            const b = sym('test');
            let count = 0;
            for (let i = 0; i < 100000; i++) {
                if (symbolEq(a, b)) count++;
            }
            return count;
        },
        baselineMs: 50
    },
    {
        name: 'unification-simple',
        code: () => {
            const a = sym('X');
            const b = sym('X');
            let count = 0;
            for (let i = 0; i < 50000; i++) {
                if (Unify.unify(a, b, new Map())) count++;
            }
            return count;
        },
        baselineMs: 100
    },
    {
        name: 'rule-lookup-1000',
        code: async () => {
            const space = new Space();
            for (let i = 0; i < 1000; i++) {
                space.addRule(`(rule${i} $x)`, `(result${i} $x)`);
            }
            let count = 0;
            for (let i = 0; i < 10000; i++) {
                const rules = space.rulesFor(sym('rule500'));
                count += rules.length;
            }
            return count;
        },
        baselineMs: 500
    },
    /*
    {
        name: 'fibonacci-5',
        code: async () => {
            const interp = new MeTTaInterpreter();
            await interp.load(`
                (= (fib 0) 0)
                (= (fib 1) 1)
                (= (fib $n) (+ (fib (- $n 1)) (fib (- $n 2))))
            `);
            // MeTTaInterpreter has run(), not eval() for simple expressions usually
            // Adjust based on API (checking MeTTaInterpreter.js might be needed)
            // Assuming .run() returns a result object
            return await interp.run('!(fib 5)');
        },
        baselineMs: 1000
    }
    */
];

export async function runBenchmarks(options = {}) {
    const results = [];

    for (const bench of BENCHMARKS) {
        if (options.comparison) {
            const result = await runComparison(bench.code);
            results.push({name: bench.name, ...result});
        } else {
            const start = performance.now();
            bench.code();
            const elapsed = performance.now() - start;

            results.push({
                name: bench.name,
                elapsed: elapsed.toFixed(2) + 'ms',
                target: bench.baselineMs + 'ms',
                status: elapsed < bench.baselineMs ? '✅' : '⚠️'
            });
        }
    }

    return results;
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    const comparison = args.includes('--comparison');
    runBenchmarks({comparison}).then(console.table);
}
