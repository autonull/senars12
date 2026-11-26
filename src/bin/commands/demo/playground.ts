/**
 * `senars demo playground` — Interactive REPL with tutorials
 *
 * Extracted from startPlayground in senars-commands.ts
 */

import { getProfileRegistry, getGenomeRegistry, profileHelpSection } from '../../lib/cli-utils';
import { createAgentFromEnv, runAgent } from '../../lib/lifecycle';
import { readAppEnvConfig } from '../../lib/env-config';
import { maybeStartWebUI } from '../../lib/entrypoint-base';
import { runEntrypoint } from '../../lib/fatal-error';
import { runCLI, standardSections, type CommonFlags, type HelpSection } from '../../lib/cli-utils';
import { createLogger } from '@senars/util/logger';
import type { CommandModule } from '../../lib/cli';

const logger = createLogger({ scope: 'demo:playground' });

const profiles = [
  { kind: 'logic', name: 'Logic', description: 'Pure logical reasoning engine' },
  { kind: 'coprocessor', name: 'Coprocessor', description: 'Logic + embedding oracle' },
  { kind: 'agent', name: 'Agent', description: 'Full autonomous agent' },
  { kind: 'device', name: 'Device', description: 'Zero-LM edge profile' },
];

export const sections: HelpSection[] = [
  standardSections.usage('senars demo playground', 'Start interactive playground REPL with tutorials'),
  profileHelpSection(profiles),
  {
    title: 'Options',
    lines: [
      '-p, --profile <kind>     Select profile: logic | coprocessor | agent | device (default: device)',
      '--web-ui                 Enable Web UI',
      '--port <number>          Web UI port (default: 8765)',
      '--tutorial <name>        Guided tutorial: basics, logic, tools, self',
      '--scenario <file>        Load scenario file',
      '--visualize              Live concept graph visualization',
      '--explain                Narrate reasoning steps',
      '--no-ai                  Logic-only mode (no LM)',
      '-v, --version            Show version',
      '--verbose                Verbose output',
      '--quiet                  Suppress non-error output',
    ],
  },
  standardSections.examples([
    'senars demo playground',
    'senars demo playground --profile logic --web-ui',
    'senars demo playground --tutorial basics --visualize',
    'senars demo playground --scenario ./my-scenario.json',
  ]),
];

async function main(flags: CommonFlags): Promise<void> {
  console.log('\n🎮 SeNARS Playground\n');

  const registry = await getProfileRegistry();
  const profileKind = flags.profile ?? 'device';
  const profile = registry.get(profileKind);

  if (!profile) {
    console.log(`Profile "${profileKind}" not found, using device profile`);
    const deviceProfile = registry.get('device');
    if (!deviceProfile) {
      console.error('Device profile not found');
      process.exit(1);
    }
    return;
  }

  console.log(`Profile: ${profile.name} (${profile.kind})`);
  console.log(`Description: ${profile.description}`);
  console.log(`LM Required: ${profile.requiresLM ? 'Yes' : 'No'}`);
  console.log(`Faculties: ${profile.faculties.join(', ')}`);
  console.log(`Oracles: ${profile.oracles.join(', ')}`);
  console.log(`Packs: ${profile.packs.join(', ')}`);
  console.log('');

  const { parseFlags } = await import('@senars/util/cli');
  const playgroundFlags = parseFlags();

  const tutorial = playgroundFlags.str('--tutorial', '');
  const scenario = playgroundFlags.str('--scenario', '');
  const visualize = playgroundFlags.has('--visualize');
  const explain = playgroundFlags.has('--explain');
  const noAI = playgroundFlags.has('--no-ai');

  if (tutorial) {
    console.log(`Tutorial: ${tutorial} (not yet implemented)`);
  }
  if (scenario) {
    console.log(`Scenario: ${scenario} (not yet implemented)`);
  }
  if (visualize) {
    console.log('Visualization: enabled (not yet implemented)');
  }
  if (explain) {
    console.log('Explain mode: enabled (not yet implemented)');
  }
  if (noAI) {
    console.log('Logic-only mode: enabled');
  }

  const readline = await import('node:readline/promises');
  const { stdin: input, stdout: output } = process;
  const rl = readline.createInterface({ input, output });

  console.log('Type "help" for commands, "exit" to quit.\n');

  const genome = await getGenomeRegistry();

  while (true) {
    const line = await rl.question('senars> ');
    const trimmed = line.trim();

    if (!trimmed) continue;
    if (trimmed === 'exit' || trimmed === 'quit') break;

    if (trimmed === 'help') {
      console.log(`
Commands:
  help              Show this help
  profile           Show current profile
  profiles          List available profiles
  packs             List domain packs
  genome            List registered schemas
  generate <id>     Generate artifacts for schema
  agent <input>     Run agent cycle with input
  logic <narsese>   Prove Narsese statement
  exit              Quit playground
      `);
      continue;
    }

    if (trimmed === 'profile') {
      console.log(`Current: ${profile.name} (${profile.kind})`);
      continue;
    }

    if (trimmed === 'profiles') {
      const profiles = registry.getAll();
      console.log('\nAvailable Profiles:\n');
      for (const p of profiles) {
        console.log(`  ${p.kind.padEnd(12)} ${p.name} - ${p.description}`);
      }
      console.log('');
      continue;
    }

    if (trimmed === 'packs') {
      const { listPacks } = await import('../../lib/senars-commands');
      listPacks();
      continue;
    }

    if (trimmed === 'genome') {
      console.log('\nRegistered schemas:');
      for (const s of genome.getAll()) {
        console.log(`  ${s.id}: ${s.name}`);
      }
      console.log('');
      continue;
    }

    if (trimmed.startsWith('generate ')) {
      const schemaId = trimmed.slice(9).trim();
      const { generateSchema } = await import('../../lib/senars-commands');
      await generateSchema(schemaId);
      continue;
    }

    if (trimmed.startsWith('agent ')) {
      const inputText = trimmed.slice(6).trim();
      console.log(`[Agent] Processing: ${inputText}`);
      console.log('[Agent] Response: (not yet implemented)');
      continue;
    }

    if (trimmed.startsWith('logic ')) {
      const narsese = trimmed.slice(6).trim();
      console.log(`[Logic] Proving: ${narsese}`);
      console.log('[Logic] Result: (not yet implemented)');
      continue;
    }

    console.log(`Unknown command: ${trimmed}. Type "help" for commands.`);
  }

  rl.close();
  console.log('\nGoodbye!');
}

export const demoPlaygroundModule: CommandModule = {
  main,
  sections,
};

// Allow direct execution for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  runEntrypoint(() => runCLI(main, { sections, version: '0.0.0' }));
}