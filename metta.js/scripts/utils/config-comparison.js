#!/usr/bin/env node

import {exec, spawn} from 'child_process';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {writeFile} from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const USAGE_MESSAGE = `
Usage: node scripts/utils/config-comparison.js [options]

Options:
  --help, -h              Show this help message
  --run <configs>         Run comparison between configs (comma-separated)
  --benchmark             Run performance benchmarks for each config
  --analysis              Run analysis for each config  
  --demo                  Run demo for each config
  --output <dir>          Output directory for results (default: comparison-results)
  --timeout <ms>          Timeout for each run (default: 60000)

Examples:
  node scripts/utils/config-comparison.js --run default,aggressive,conservative
  node scripts/utils/config-comparison.js --run my-config1,my-config2 --benchmark
  node scripts/utils/config-comparison.js --run experimental --analysis --demo
`;

const DEFAULT_CONFIG = Object.freeze({
    configList: ['default'],
    outputDir: 'comparison-results',
    timeout: 60000
});

const HELP_ARGS = ['--help', '-h'];
const MODE_ARGS = ['--benchmark', '--analysis', '--demo'];

function showUsage() {
    console.log(USAGE_MESSAGE);
}

/**
 * Check if help was requested
 */
function isHelpRequested(args) {
    return args.some(arg => HELP_ARGS.includes(arg));
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
    let configList = [...DEFAULT_CONFIG.configList];
    let runBenchmark = args.includes('--benchmark');
    let runAnalysis = args.includes('--analysis');
    let runDemo = args.includes('--demo');
    let outputDir = DEFAULT_CONFIG.outputDir;
    let timeout = DEFAULT_CONFIG.timeout;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--run' && args[i + 1]) {
            configList = args[i + 1].split(',');
            i++;
        } else if (args[i] === '--output' && args[i + 1]) {
            outputDir = args[i + 1];
            i++;
        } else if (args[i] === '--timeout' && args[i + 1]) {
            timeout = parseInt(args[i + 1]);
            i++;
        }
    }

    // Default to at least running analysis if no specific mode is specified
    if (!runBenchmark && !runAnalysis && !runDemo) {
        runAnalysis = true;
    }

    return {configList, runBenchmark, runAnalysis, runDemo, outputDir, timeout};
}

/**
 * Execute a process with timeout
 */
async function runProcess(command, args, env, cwd, timeout, configName, operationName) {
    const processObj = spawn(command, args, {
        env: {
            ...process.env,
            ...env
        },
        cwd,
        timeout: timeout
    });

    let output = '';
    processObj.stdout.on('data', (data) => {
        output += data.toString();
    });

    processObj.stderr.on('data', (data) => {
        console.error(`  Error in ${operationName} for ${configName}:`, data.toString());
    });

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            processObj.kill();
            reject(new Error(`${operationName} for ${configName} timed out`));
        }, timeout);

        processObj.on('close', (code) => {
            clearTimeout(timeoutId);
            resolve({
                exitCode: code,
                output,
                success: code === 0
            });
        });
    });
}

/**
 * Run configuration analysis
 */
async function runAnalysis(config, {outputDir, timeout}) {
    console.log(`  Running analysis for ${config}...`);
    try {
        const result = await runProcess(
            'node',
            ['comprehensive_analysis.js'],
            {SENARS_CONFIG: config},
            join(__dirname, '../..'),
            timeout,
            config,
            'analysis'
        );

        // Save analysis output
        await writeFile(`${outputDir}/results/analysis_${config}.txt`, result.output);
        return result;
    } catch (error) {
        console.error(`  Analysis failed for ${config}:`, error.message);
        return {success: false, error: error.message};
    }
}

/**
 * Run configuration benchmark
 */
async function runBenchmark(config, {outputDir, timeout}) {
    console.log(`  Running benchmarks for ${config}...`);
    try {
        const result = await runProcess(
            'node',
            ['src/testing/runBenchmarks.js'],
            {SENARS_CONFIG: config},
            join(__dirname, '../..'),
            timeout,
            config,
            'benchmark'
        );

        // Save benchmark output
        await writeFile(`${outputDir}/results/benchmark_${config}.txt`, result.output);
        return result;
    } catch (error) {
        console.error(`  Benchmark failed for ${config}:`, error.message);
        return {success: false, error: error.message};
    }
}

/**
 * Run configuration demo
 */
async function runDemo(config, {outputDir, timeout}) {
    console.log(`  Running demo for ${config}...`);
    try {
        const result = await runProcess(
            'node',
            ['run-demo.js'],
            {SENARS_CONFIG: config},
            join(__dirname, '../..'),
            timeout,
            config,
            'demo'
        );

        // Save demo output
        await writeFile(`${outputDir}/results/demo_${config}.txt`, result.output);
        return result;
    } catch (error) {
        console.error(`  Demo failed for ${config}:`, error.message);
        return {success: false, error: error.message};
    }
}

/**
 * Generate summary report
 */
function generateSummary(configList, results) {
    const summary = {
        timestamp: new Date().toISOString(),
        configurations: configList,
        results: results,
        summary: {}
    };

    // Calculate summary statistics
    for (const config in results) {
        const configResult = results[config];
        summary.summary[config] = {
            analysis_success: configResult.analysis?.success || false,
            benchmark_success: configResult.benchmark?.success || false,
            demo_success: configResult.demo?.success || false
        };
    }

    return summary;
}

/**
 * Print summary to console
 */
function printSummary(summary) {
    console.log('\\n📈 Summary:');
    for (const config in summary.summary) {
        const stats = summary.summary[config];
        console.log(`  ${config}:`);
        console.log(`    Analysis: ${stats.analysis_success ? '✅' : '❌'}`);
        console.log(`    Benchmark: ${stats.benchmark_success ? '✅' : '❌'}`);
        console.log(`    Demo: ${stats.demo_success ? '✅' : '❌'}`);
    }
}

async function main() {
    const args = process.argv.slice(2);

    if (isHelpRequested(args)) {
        showUsage();
        process.exit(0);
    }

    const {configList, runBenchmark, runAnalysis, runDemo, outputDir, timeout} = parseArgs(args);
    console.log(`Running configuration comparison: ${configList.join(', ')}`);

    try {
        console.log(`\\n📊 Starting configuration comparison...`);

        // Create output directory
        await exec(`mkdir -p ${outputDir} ${outputDir}/configs ${outputDir}/results`);

        const results = {};

        for (const config of configList) {
            console.log(`\\n🧪 Testing configuration: ${config}`);

            const configResult = {};

            if (runAnalysis) {
                configResult.analysis = await runAnalysis(config, {outputDir, timeout});
            }

            if (runBenchmark) {
                configResult.benchmark = await runBenchmark(config, {outputDir, timeout});
            }

            if (runDemo) {
                configResult.demo = await runDemo(config, {outputDir, timeout});
            }

            results[config] = configResult;
        }

        const summary = generateSummary(configList, results);

        // Write summary report
        await writeFile(`${outputDir}/comparison-summary.json`, JSON.stringify(summary, null, 2));

        console.log('\\n✅ Configuration comparison completed!');
        console.log(`📊 Results saved to: ${outputDir}/`);

        // Print summary to console
        printSummary(summary);
    } catch (error) {
        console.error('Error running configuration comparison:', error);
        process.exit(1);
    }
}

main();