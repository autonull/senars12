#!/usr/bin/env node

/**
 * SeNARS Agent REPL Comprehensive Demo Runner
 * Runs all automated examples and demonstrations
 */

import {spawn} from 'child_process';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runDemo(scriptPath, description) {
    return new Promise((resolve, reject) => {
        console.log(`\n🚀 Running: ${description}`);
        console.log(`   Script: ${scriptPath}`);
        console.log('─'.repeat(60));

        const child = spawn('node', [scriptPath], {
            stdio: 'inherit',
            cwd: __dirname
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ SUCCESS: ${description} completed\n`);
                resolve();
            } else {
                console.log(`❌ FAILED: ${description} failed with code ${code}\n`);
                // Don't reject to continue with other demos
                resolve();
            }
        });

        child.on('error', (error) => {
            console.log(`❌ ERROR: ${description} failed with error: ${error.message}\n`);
            resolve(); // Continue with other demos
        });
    });
}

async function runAllDemos() {
    console.log('🤖🎨 SeNARS Agent REPL Comprehensive Demo Suite');
    console.log('='.repeat(60));
    console.log('Running all automated examples and demonstrations\n');

    const demos = [
        {
            path: './example-agent-repl-ollama.js',
            description: 'Advanced Agent REPL with Ollama Integration (Requires Ollama)'
        },
        {
            path: './example-research-scenario.js',
            description: 'AI Research Scenario with Hybrid Reasoning'
        },
        {
            path: './example-fallback-mechanism.js',
            description: 'LM Fallback Mechanism Demonstration'
        }
    ];

    if (demos.length === 0) {
        console.log('⚠️  No runnable demos found. Demos need update for new architecture.');
    }

    for (const demo of demos) {
        try {
            await runDemo(demo.path, demo.description);
        } catch (error) {
            console.log(`⚠️  Demo ${demo.path} had an issue: ${error.message}`);
        }
    }

    console.log('🏆 ALL DEMONSTRATIONS COMPLETED!');
    console.log('\n📝 Note: Some demos require Ollama to be running locally.');
}

// Run all demos
runAllDemos().catch(console.error);
