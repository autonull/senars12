/**
 * SeNARS12 Application Entry Point
 * Demonstrates separation of concerns:
 * - Configuration loading (config/loader)
 * - NAR instance creation (factory)
 * - Application logic (CLI, Bot, etc.)
 */

import {loadConfigFromEnv} from './config';
import {SeNARSFactory} from './nar';

const MODES = {
    cli: runCLI,
    bot: runBot,
    demo: runDemo,
} as const;

async function main() {
    const mode = process.argv[2] || 'demo';

    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║ SeNARS12 - Neuro-Symbolic Reasoning System ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    try {
        await MODES[mode as keyof typeof MODES]?.() ?? await runDemo();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

async function runCLI() {
    console.log('Starting CLI mode...');
    await import('./cli/repl.js');
}

async function runBot() {
  console.log('Starting Bot mode...');
  const {Agent} = await import('./agent/Agent.js');
  const {SeNARSFactory} = await import('./nar/index.js');
  const {createSeNARSRegistry} = await import('./nar/lm/providers.js');

  const registry = createSeNARSRegistry();
  const nar = SeNARSFactory.createDefault({
    core: {maxConcepts: 100, maxDerivationDepth: 10},
    enableLMRules: true,
    providerRegistry: registry,
  });

  const agent = new Agent(nar);
  await agent.start();

  process.on('SIGINT', async () => {
    await agent.stop();
    process.exit(0);
  });
}

async function runDemo() {
    console.log('Running demo mode...\n');

    const config = await loadConfigFromEnv();
    console.log(`Configuration loaded: ${config.name} v${config.version}`);
    console.log(` LM Provider: ${config.lm.provider}`);
    console.log(` Max Concepts: ${config.core.maxConcepts}\n`);

    const nar = SeNARSFactory.createDefault({
        core: {
            maxConcepts: config.core.maxConcepts,
            priorityThreshold: config.core.priorityThreshold,
            activationDecayRate: config.core.activationDecayRate,
            consolidationInterval: config.core.consolidationInterval,
            cpuThrottleMs: config.core.cpuThrottleMs,
            maxDerivationDepth: config.core.maxDerivationDepth,
            maxDerivationsPerStep: config.core.maxDerivationsPerStep,
        },
    });

    console.log('Demo: Basic reasoning');
    await nar.input('(bird --> animal).');
    await nar.input('(robin --> bird).');

    const derived = await nar.run(5);
    console.log(`Derived ${derived} new belief(s)`);

    const concepts = nar.listConcepts();
    console.log(`Memory contains ${concepts.length} concept(s)\n`);

    console.log('✓ Demo complete');
}

main();
