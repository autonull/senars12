#!/usr/bin/env node

import {spawn} from 'child_process';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);

function showUsage() {
    console.log(`
Usage: node scripts/utils/automated-dev-workflow.js [options]

Options:
  --help, -h              Show this help message
  --visual-inspection     Run visual inspection tests with screenshots
  --tune-heuristics       Run heuristic tuning with visual feedback
  --regression-tests      Run full regression test suite
  --performance-bench     Run performance benchmarks
  --analysis              Run comprehensive analysis
  --demo-run              Run demonstration and capture results
  --all                   Run complete development workflow
  --with-ui               Include UI in operations (default: headless)
  --iterations <n>        Number of iterations for tuning (default: 5)

Examples:
  node scripts/utils/automated-dev-workflow.js --visual-inspection
  node scripts/utils/automated-dev-workflow.js --tune-heuristics --iterations 10
  node scripts/utils/automated-dev-workflow.js --all
    `);
}

if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(0);
}

// Parse arguments
let operation = 'visual-inspection'; // default
let includeUI = args.includes('--with-ui');
let iterations = 5;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--visual-inspection') {
        operation = 'visual-inspection';
    } else if (args[i] === '--tune-heuristics') {
        operation = 'tune-heuristics';
    } else if (args[i] === '--regression-tests') {
        operation = 'regression-tests';
    } else if (args[i] === '--performance-bench') {
        operation = 'performance-bench';
    } else if (args[i] === '--analysis') {
        operation = 'analysis';
    } else if (args[i] === '--demo-run') {
        operation = 'demo-run';
    } else if (args[i] === '--all') {
        operation = 'all';
    } else if (args[i] === '--iterations' && args[i + 1]) {
        iterations = parseInt(args[i + 1]);
        i++;
    }
}

console.log(`Running automated development workflow: ${operation}`);

async function runWorkflow() {
    try {
        const workflowTasks = [
            {op: 'visual-inspection', fn: runVisualInspection},
            {op: 'tune-heuristics', fn: runHeuristicTuning},
            {op: 'regression-tests', fn: runRegressionTests},
            {op: 'performance-bench', fn: runPerformanceBench},
            {op: 'analysis', fn: runAnalysis},
            {op: 'demo-run', fn: runDemo}
        ];

        for (const {op, fn} of workflowTasks) {
            if (operation === op || operation === 'all') {
                await fn();
            }
        }

        console.log('\\n✅ Automated development workflow completed successfully!');
    } catch (error) {
        console.error('Error running development workflow:', error);
        process.exit(1);
    }
}

// Helper function to run a spawn process with promise
const runSpawnProcess = (cmd, args, opts = {}) => {
    const spawnOpts = {
        stdio: 'inherit',
        cwd: join(__dirname, '../..'),
        ...opts
    };

    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, spawnOpts);

        child.on('error', reject);
        child.on('close', (code) => {
            if (code !== 0) reject(new Error(`${cmd} failed with code ${code}`));
            else resolve(code);
        });
    });
};

// Visual inspection task
const runVisualInspection = async () => {
    console.log('\\n🔍 Running visual inspection tests...');
    await runSpawnProcess('npm', ['run', 'capture']);
};

// Heuristic tuning task
const runHeuristicTuning = async () => {
    console.log('\\n⚙️  Running heuristic tuning...');
    for (let i = 0; i < iterations; i++) {
        console.log(`\\nIteration ${i + 1}/${iterations}`);

        // Run analysis to gather data
        await runSpawnProcess('npm', ['run', 'analyze'], {stdio: 'pipe'});

        // Capture visualizations after each analysis
        await runSpawnProcess('npm', ['run', 'capture']);
    }
};

// Regression tests task
const runRegressionTests = async () => {
    console.log('\\n🧪 Running regression tests...');
    await runSpawnProcess('npm', ['run', 'test:all']);
};

// Performance benchmark task
const runPerformanceBench = async () => {
    console.log('\\n⏱️  Running performance benchmarks...');
    await runSpawnProcess('npm', ['run', 'benchmark']);
};

// Analysis task
const runAnalysis = async () => {
    console.log('\\n🧠 Running comprehensive analysis...');
    await runSpawnProcess('npm', ['run', 'analyze']);
};

// Demo task
const runDemo = async () => {
    console.log('\\n🎬 Running demonstration...');
    await runSpawnProcess('npm', ['run', 'demo']);
};

runWorkflow();