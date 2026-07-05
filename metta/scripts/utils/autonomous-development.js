#!/usr/bin/env node

import * as dfd from 'danfojs';
import {ScriptUtils} from './script-utils.js';
import {ConfigUtils} from './config-utils.js';
import {ProcessUtils} from './process-utils.js';
import {EvolutionUtils} from './evolution-utils.js';
import {writeFile} from 'fs/promises';

const {args, helpRequested} = ScriptUtils.parseArgs(process.argv.slice(2));

const USAGE_MESSAGE = `
Usage: node scripts/utils/autonomous-development.js [options]

Options:
  --help, -h              Show this help message
  --mode <mode>           Mode: tune-heuristics|ui-optimization|self-development (default: tune-heuristics)
  --generations <n>       Number of generations to run (default: 10)
  --population <n>        Population size for genetic algorithm (default: 5)
  --visual-feedback       Use visual feedback for optimization (default: true)
  --performance-goal      Optimize for performance metrics
  --ui-goal               Optimize for UI experience metrics
  --config-template <f>   Config template file for starting parameters
  --output-dir <dir>      Output directory (default: auto-development-results)
  --iterations <n>        Iterations per generation (default: 3)

Examples:
  node scripts/utils/autonomous-development.js --mode tune-heuristics
  node scripts/utils/autonomous-development.js --mode ui-optimization --generations 20
  node scripts/utils/autonomous-development.js --mode self-development --visual-feedback
`;

if (helpRequested) {
    ScriptUtils.showUsageAndExit(USAGE_MESSAGE);
}

// Default configuration
const DEFAULTS = {
    mode: 'tune-heuristics',
    generations: 10,
    populationSize: 5,
    useVisualFeedback: true,
    optimizePerformance: false,
    optimizeUI: false,
    configTemplate: null,
    outputDir: 'auto-development-results',
    iterationsPerGen: 3
};

// Parse arguments with type conversion
const argSpecs = {
    '--mode': {key: 'mode', parser: ConfigUtils.parseString},
    '--generations': {key: 'generations', parser: ConfigUtils.parseInt},
    '--population': {key: 'populationSize', parser: ConfigUtils.parseInt},
    '--visual-feedback': {key: 'useVisualFeedback', boolean: true},
    '--no-visual-feedback': {key: 'useVisualFeedback', boolean: true},
    '--performance-goal': {key: 'optimizePerformance', boolean: true},
    '--ui-goal': {key: 'optimizeUI', boolean: true},
    '--config-template': {key: 'configTemplate', parser: ConfigUtils.parseString},
    '--output-dir': {key: 'outputDir', parser: ConfigUtils.parseString},
    '--iterations': {key: 'iterationsPerGen', parser: ConfigUtils.parseInt}
};

const parsedArgs = ConfigUtils.parseArgs(args, argSpecs);
const config = ConfigUtils.createConfig(DEFAULTS, parsedArgs);

// Set default optimization goals based on mode
if (config.mode === 'tune-heuristics') {
    config.optimizePerformance = true;
} else if (config.mode === 'ui-optimization') {
    config.optimizeUI = true;
} else if (config.mode === 'self-development') {
    config.optimizePerformance = true;
    config.optimizeUI = true;
    config.useVisualFeedback = true;
}

console.log(`Running autonomous development in mode: ${config.mode}`);

// Define parameter ranges for evolution
const PARAMETER_RANGES = {
    memory: {
        maxConcepts: {min: 10, max: 1000},
        maxTasksPerConcept: {min: 5, max: 100},
        priorityThreshold: {min: 0.01, max: 0.99},
        priorityDecayRate: {min: 0.001, max: 0.1}
    },
    reasoning: {
        inferenceThreshold: {min: 0.01, max: 0.99},
        conceptForgottenRatio: {min: 0.01, max: 0.5},
        taskForgottenRatio: {min: 0.01, max: 0.5}
    },
    visualization: {
        updateInterval: {min: 100, max: 5000},
        maxDisplayItems: {min: 10, max: 500}
    }
};

async function evaluateConfiguration(configToEvaluate, generation, individual) {
    console.log(`  Evaluating configuration ${individual} in generation ${generation}...`);

    // Create a temporary config file for this evaluation
    const tempConfigFile = `${config.outputDir}/temp-config-${generation}-${individual}.json`;
    await writeFile(tempConfigFile, JSON.stringify(configToEvaluate, null, 2));

    const evaluationResult = {};

    // If using visual feedback, run visualizations and capture results
    if (config.useVisualFeedback) {
        console.log(`    Running visual analysis...`);

        try {
            const {code, stdout, stderr} = await ProcessUtils.spawnProcess('node', ['run-demo.js'], {
                env: {
                    ...process.env,
                    SENARS_CONFIG_FILE: tempConfigFile
                }
            });

            evaluationResult.visualSuccess = code === 0;
            evaluationResult.visualOutput = stdout + stderr;
            evaluationResult.visualExitCode = code;

            // In a real system, we'd analyze the visual output here
            // For now, we'll just record that it ran successfully
            evaluationResult.visualScore = evaluationResult.visualSuccess ? Math.random() : 0;

        } catch (error) {
            console.error(`    Visual evaluation failed: ${error.message}`);
            evaluationResult.visualSuccess = false;
            evaluationResult.visualScore = 0;
        }
    }

    // If optimizing for performance, run benchmarks
    if (config.optimizePerformance) {
        console.log(`    Running performance analysis...`);

        try {
            const {code, stdout, stderr} = await ProcessUtils.spawnProcess('node', ['src/testing/runBenchmarks.js'], {
                env: {
                    ...process.env,
                    SENARS_CONFIG_FILE: tempConfigFile
                }
            });

            evaluationResult.perfSuccess = code === 0;
            evaluationResult.perfOutput = stdout + stderr;
            evaluationResult.perfExitCode = code;

            // Simple performance scoring based on success and arbitrary metrics
            evaluationResult.perfScore = evaluationResult.perfSuccess ?
                (0.5 + Math.random() * 0.5) : 0; // Random score for demo purposes

        } catch (error) {
            console.error(`    Performance evaluation failed: ${error.message}`);
            evaluationResult.perfSuccess = false;
            evaluationResult.perfScore = 0;
        }
    }

    // Calculate overall fitness score
    let totalScore = 0;
    let scoreCount = 0;

    if (config.useVisualFeedback) {
        totalScore += evaluationResult.visualScore * 0.4; // 40% weight to visual
        scoreCount += 0.4;
    }

    if (config.optimizePerformance) {
        totalScore += evaluationResult.perfScore * 0.6; // 60% weight to performance
        scoreCount += 0.6;
    }

    evaluationResult.fitness = scoreCount > 0 ? totalScore / scoreCount : 0;

    // Clean up temp file
    try {
        await ProcessUtils.executeCommand(`rm -f ${tempConfigFile}`);
    } catch (error) {
        // Ignore cleanup errors
    }

    return evaluationResult;
}

async function runAutonomousDevelopment() {
    try {
        console.log(`\n🤖 Starting autonomous development in mode: ${config.mode}`);
        console.log(`📊 Parameters: generations=${config.generations}, population=${config.populationSize}`);

        // Create output directory
        await ProcessUtils.executeCommand(`mkdir -p ${config.outputDir} ${config.outputDir}/generations ${config.outputDir}/configs ${config.outputDir}/results`);

        // Initialize population
        let population = [];
        console.log('\n🌱 Initializing population...');

        for (let i = 0; i < config.populationSize; i++) {
            const configIndividual = EvolutionUtils.generateRandomConfig(PARAMETER_RANGES);
            population.push({
                config: configIndividual,
                id: i
            });
        }

        const evolutionHistory = [];

        // Main evolution loop
        for (let gen = 0; gen < config.generations; gen++) {
            console.log(`\n GenerationType ${gen + 1}/${config.generations}`);

            // Evaluate entire population
            for (let i = 0; i < population.length; i++) {
                const individual = population[i];
                const result = await evaluateConfiguration(individual.config, gen, i);

                individual.fitness = result.fitness;
                individual.evaluation = result;

                console.log(`    Individual ${i}: Fitness = ${individual.fitness.toFixed(4)}`);
            }

            // Sort by fitness (descending)
            population.sort((a, b) => (b.fitness || 0) - (a.fitness || 0));

            // Record best of generation
            const bestOfGen = population[0];
            // Extract fitness values for danfojs analysis
            const fitnessValues = population.map(ind => ind.fitness || 0);
            const fitnessSeries = new dfd.Series(fitnessValues);

            evolutionHistory.push({
                generation: gen,
                bestFitness: bestOfGen.fitness,
                averageFitness: fitnessSeries.mean(),
                stdFitness: fitnessSeries.std(),
                medianFitness: fitnessSeries.median(),
                bestConfig: bestOfGen.config
            });

            console.log(`    Best fitness: ${bestOfGen.fitness.toFixed(4)}`);

            // Save best config of generation
            await EvolutionUtils.saveConfig(
                bestOfGen.config,
                `${config.outputDir}/generations/gen-${gen}-best.json`
            );

            // Create next generation (except for the last generation)
            if (gen < config.generations - 1) {
                population = await EvolutionUtils.createNextGeneration(
                    population,
                    PARAMETER_RANGES,
                    {
                        populationSize: config.populationSize,
                        mutationRate: 0.1,
                        elitismCount: 1
                    }
                );
            }
        }

        // Select overall best
        population.sort((a, b) => (b.fitness || 0) - (a.fitness || 0));
        const bestOverall = population[0];

        // Generate final report
        const finalReport = {
            timestamp: new Date().toISOString(),
            mode: config.mode,
            parameters: {
                generations: config.generations,
                populationSize: config.populationSize,
                useVisualFeedback: config.useVisualFeedback,
                optimizePerformance: config.optimizePerformance,
                optimizeUI: config.optimizeUI
            },
            evolutionHistory,
            bestConfiguration: bestOverall.config,
            bestFitness: bestOverall.fitness,
            summary: {
                initialAverage: evolutionHistory[0].averageFitness,
                finalAverage: evolutionHistory[evolutionHistory.length - 1].averageFitness,
                initialStd: evolutionHistory[0].stdFitness,
                finalStd: evolutionHistory[evolutionHistory.length - 1].stdFitness,
                bestFitness: bestOverall.fitness
            }
        };

        await writeFile(`${config.outputDir}/final-report.json`, JSON.stringify(finalReport, null, 2));

        console.log('\n🎉 Autonomous development completed!');
        console.log(`🏆 Best fitness achieved: ${bestOverall.fitness.toFixed(4)}`);
        console.log(`📊 Results saved to: ${config.outputDir}/`);

        // Print summary to console
        console.log('\n📈 Evolution Summary:');
        console.log(`  Initial average fitness: ${finalReport.summary.initialAverage.toFixed(4)}`);
        console.log(`  Final average fitness: ${finalReport.summary.finalAverage.toFixed(4)}`);
        console.log(`  Initial fitness std: ${finalReport.summary.initialStd.toFixed(4)}`);
        console.log(`  Final fitness std: ${finalReport.summary.finalStd.toFixed(4)}`);
        console.log(`  Best fitness: ${finalReport.summary.bestFitness.toFixed(4)}`);
        const improvement = ((finalReport.summary.finalAverage / finalReport.summary.initialAverage - 1) * 100).toFixed(2);
        console.log(`  Improvement: ${improvement}% average`);

    } catch (error) {
        console.error('Error running autonomous development:', error);
        process.exit(1);
    }
}

runAutonomousDevelopment();