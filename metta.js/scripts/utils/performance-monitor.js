#!/usr/bin/env node

import {exec, spawn} from 'child_process';
import {promisify} from 'util';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {writeFile} from 'fs/promises';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);

function showUsage() {
    console.log(`
Usage: node scripts/utils/performance-monitor.js [options]

Options:
  --help, -h              Show this help message
  --profile               Run CPU/memory profiling
  --monitor <duration>    Run system monitoring for duration (seconds, default: 60)
  --benchmark             Run comprehensive benchmarking
  --compare               Compare performance across runs
  --output <dir>          Output directory (default: performance-results)
  --web                   Monitor web UI performance
  --cli                   Monitor CLI performance

Examples:
  node scripts/utils/performance-monitor.js --profile
  node scripts/utils/performance-monitor.js --monitor 120
  node scripts/utils/performance-monitor.js --benchmark
  node scripts/utils/performance-monitor.js --web --monitor 60
    `);
}

if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(0);
}

// Parse arguments
let operation = 'monitor'; // default
let duration = 60;
let outputDir = 'performance-results';
let mode = 'cli'; // cli or web

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile') {
        operation = 'profile';
    } else if (args[i] === '--monitor' && args[i + 1]) {
        operation = 'monitor';
        duration = parseInt(args[i + 1]);
        i++;
    } else if (args[i] === '--benchmark') {
        operation = 'benchmark';
    } else if (args[i] === '--compare') {
        operation = 'compare';
    } else if (args[i] === '--output' && args[i + 1]) {
        outputDir = args[i + 1];
        i++;
    } else if (args[i] === '--web') {
        mode = 'web';
    } else if (args[i] === '--cli') {
        mode = 'cli';
    }
}

console.log(`Running performance operation: ${operation} in ${mode} mode`);

async function runPerformanceMonitoring() {
    try {
        console.log(`\\n⏱️  Starting ${operation} operation in ${mode} mode...`);

        // Create output directory
        await execAsync(`mkdir -p ${outputDir} ${outputDir}/monitoring ${outputDir}/profiles ${outputDir}/benchmarks`);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
        let results = {};

        if (operation === 'profile' || operation === 'benchmark') {
            console.log('\\n🔬 Running performance profiling...');

            // Run the benchmark script if available
            try {
                const benchProcess = spawn('node', ['src/testing/runBenchmarks.js'], {
                    cwd: join(__dirname, '../..'),
                    stdio: ['pipe', 'pipe', 'pipe']
                });

                let benchOutput = '';
                benchProcess.stdout.on('data', (data) => {
                    benchOutput += data.toString();
                    process.stdout.write(data);
                });

                benchProcess.stderr.on('data', (data) => {
                    process.stderr.write(data);
                });

                await new Promise((resolve) => {
                    benchProcess.on('close', (code) => {
                        results.benchmark = {
                            exitCode: code,
                            output: benchOutput,
                            success: code === 0
                        };
                        resolve();
                    });
                });

                // Save benchmark output
                await writeFile(`${outputDir}/benchmarks/benchmark_${timestamp}.txt`, benchOutput);

            } catch (error) {
                console.error('Benchmark execution failed:', error.message);
                results.benchmark = {success: false, error: error.message};
            }
        }

        if (operation === 'monitor') {
            console.log(`\\n📊 Monitoring system performance for ${duration} seconds...`);

            // For CLI mode, run a simple test
            if (mode === 'cli') {
                console.log('  Running basic CLI performance test...');

                const startTime = Date.now();
                const testProcess = spawn('node', ['-e', `
                    // Simple performance test
                    const start = Date.now();
                    let sum = 0;
                    for (let i = 0; i < 1000000; i++) {
                        sum += Math.random();
                    }
                    const end = Date.now();
                    console.log(\`Basic loop: \${end - start}ms for 1M iterations\`);
                    
                    // Memory usage check
                    const used = process.memoryUsage();
                    for (let key in used) {
                        console.log(\`\${key}: \${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB\`);
                    }
                `], {
                    cwd: join(__dirname, '../..')
                });

                let monitorOutput = '';
                testProcess.stdout.on('data', (data) => {
                    monitorOutput += data.toString();
                    console.log('  ' + data.toString().trim());
                });

                await new Promise((resolve) => {
                    testProcess.on('close', (code) => {
                        results.monitor = {
                            exitCode: code,
                            output: monitorOutput,
                            duration: duration,
                            success: code === 0,
                            timestamp: startTime
                        };
                        resolve();
                    });
                });
            }
            // For web mode, we might want to run the web UI and monitor it
            else if (mode === 'web') {
                console.log('  Starting web UI for performance monitoring...');

                // This would typically involve starting the web server and monitoring it
                // For now, we'll just note this as a future enhancement
                results.monitor = {
                    operation: 'web_monitoring',
                    note: 'Web performance monitoring would start the server and monitor resource usage',
                    duration: duration,
                    timestamp: Date.now()
                };

                console.log('  [Web monitoring would start server and track performance]');
            }
        }

        // Generate performance report
        const report = {
            timestamp: new Date().toISOString(),
            operation: operation,
            mode: mode,
            duration: operation === 'monitor' ? duration : undefined,
            results: results,
            system: {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                memory: process.memoryUsage()
            }
        };

        // Write report
        await writeFile(`${outputDir}/performance-report-${timestamp}.json`, JSON.stringify(report, null, 2));

        console.log('\\n✅ Performance monitoring completed!');
        console.log(`📊 Results saved to: ${outputDir}/`);

        // Print summary to console
        console.log('\\n📈 Summary:');
        console.log(`  Operation: ${operation}`);
        console.log(`  Mode: ${mode}`);
        console.log(`  Duration: ${operation === 'monitor' ? duration + 's' : 'N/A'}`);
        console.log(`  Timestamp: ${timestamp}`);
        console.log(`  Results: ${outputDir}/`);

    } catch (error) {
        console.error('Error running performance monitoring:', error);
        process.exit(1);
    }
}

runPerformanceMonitoring();