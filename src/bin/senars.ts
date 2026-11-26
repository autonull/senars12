#!/usr/bin/env tsx
/**
 * `pnpm senars` / `npx senars` — unified CLI entry point.
 *
 * Profiles as data: logic, coprocessor, agent, device (+ domain packs).
 * Device profile imports zero LM.
 */

import { createProfileRegistry, PROFILE_KINDS, getAllDomainPacks } from '../profiles/index';
import { createGenomeRegistry } from '../genome/index';
import { createGeneratedMCPServer, type GeneratedMCPServerConfig } from '../surface/mcp/generated-server';
import { z } from 'zod';
import { readAppEnvConfig } from './lib/env-config';
import { createAgentFromEnv, runAgent } from './lib/lifecycle';
import { intBetween, unitInterval } from '../config/boundary';
import { runEntrypoint } from './lib/fatal-error';
import { runCLI, buildHelp, standardSections, parseCommonFlags, showHelpAndExit, profileHelpSection, maybeStartWebUI } from './lib/cli-utils';
import { createLogger } from '@senars/util/logger';

const logger = createLogger({ scope: 'senars' });

/** CLI arguments schema for non-standard flags. */
const CLISchema = z.object({
  listProfiles: z.boolean().optional(),
  listPacks: z.boolean().optional(),
  mcp: z.boolean().optional(),
  mcpPort: z.number().optional(),
  playground: z.boolean().optional(),
  generate: z.string().optional(),
  schema: z.string().optional(),
});

/** Build help sections dynamically from profile registry (lazy). */
function buildHelpSections(): { sections: any[] } {
  const registry = createProfileRegistry();
  const profiles = registry.getAll();
  const profileInfos = profiles.map((p) => ({ kind: p.kind, name: p.name, description: p.description }));

  const sections = [
    standardSections.usage('senars', 'SeNARS — The Fold: One deterministic fold over one log'),
    profileHelpSection(profileInfos),
    {
      title: 'MCP Server',
      lines: [
        '--mcp                  Start MCP server (stdio by default)',
        '--mcp-port <port>      Start MCP server on HTTP port',
      ],
    },
    {
      title: 'Playground',
      lines: ['--playground           Start interactive playground'],
    },
    {
      title: 'Generation',
      lines: [
        '--generate <schema-id> Generate artifacts for schema',
        '--schema <schema-id>   Show schema details',
      ],
    },
    {
      title: 'Listing',
      lines: [
        '--list-profiles        List available profiles',
        '--list-packs           List available domain packs',
      ],
    },
    standardSections.examples([
      'senars --profile logic',
      'senars --profile agent --mcp',
      'senars --profile device --playground',
      'senars --generate my-schema',
      'npx senars --profile coprocessor',
    ]),
  ];

  return { sections };
}

/** List profiles using registry. */
function listProfiles(): void {
  const registry = createProfileRegistry();
  const profiles = registry.getAll();

  console.log('\nAvailable Profiles:\n');
  for (const profile of profiles) {
    console.log(`  ${profile.kind.padEnd(12)} ${profile.name}`);
    console.log(`    ${profile.description}`);
    console.log(`    LM Required: ${profile.requiresLM ? 'Yes' : 'No'}`);
    console.log(`    Faculties: ${profile.faculties.join(', ')}`);
    console.log(`    Oracles: ${profile.oracles.join(', ')}`);
    console.log(`    Packs: ${profile.packs.join(', ')}`);
    console.log('');
  }
}

/** List domain packs. */
function listPacks(): void {
  const packs = getAllDomainPacks();

  console.log('\nAvailable Domain Packs:\n');
  for (const [key, pack] of Object.entries(packs)) {
    console.log(`  ${key.padEnd(20)} ${pack.name}`);
    console.log(`    ${pack.description}`);
    console.log(`    Faculties: ${pack.faculties.join(', ')}`);
    console.log(`    Oracles: ${pack.oracles.join(', ')}`);
    console.log('');
  }
}

/** Start MCP server. */
async function startMCPServer(port?: number): Promise<void> {
  const genome = createGenomeRegistry();
  const profiles = createProfileRegistry();

  // Register example schemas
  genome.register({
    id: 'task',
    name: 'Task',
    schema: z.object({
      id: z.string(),
      description: z.string(),
      priority: intBetween(0, 10),
      tags: z.array(z.string()).optional(),
    }),
    description: 'A task to execute',
    mcpTool: { name: 'task.create', description: 'Create a task', handler: 'handleTaskCreate' },
    elicitation: { title: 'Create Task', description: 'Enter task details' },
  });

  genome.register({
    id: 'belief',
    name: 'Belief',
    schema: z.object({
      term: z.string(),
      truth: z.object({ f: unitInterval, c: unitInterval }),
      tags: z.array(z.string()).optional(),
    }),
    description: 'A belief statement',
    mcpTool: { name: 'belief.add', description: 'Add a belief', handler: 'handleBeliefAdd' },
    elicitation: { title: 'Add Belief', description: 'Enter belief details' },
  });

  const config: GeneratedMCPServerConfig = {
    name: 'senars',
    version: '0.1.0',
    protocolVersion: '2026-07-28',
    capabilities: { tools: true, resources: true, prompts: true, logging: true, completions: true },
    transport: { type: port ? 'http' : 'stdio', port },
    enableGeneratedTools: true,
    enableElicitation: true,
    logRefPrefix: 'senars',
    genome,
    profiles,
  };

  const server = createGeneratedMCPServer(config);

  if (port) {
    console.log(`MCP server starting on http://localhost:${port}`);
    console.log('HTTP transport not yet implemented - use stdio mode');
  } else {
    console.log('MCP server starting on stdio');
    console.log('Stdio transport not yet fully implemented');
  }
}

/** Start playground REPL. */
async function startPlayground(profileKind?: string): Promise<void> {
  console.log('\n🎮 SeNARS Playground\n');

  const registry = createProfileRegistry();
  const profile = profileKind ? registry.get(profileKind) : registry.get('agent');

  if (!profile) {
    console.log('Profile not found, using agent profile');
    return;
  }

  console.log(`Profile: ${profile.name} (${profile.kind})`);
  console.log(`Description: ${profile.description}`);
  console.log(`LM Required: ${profile.requiresLM ? 'Yes' : 'No'}`);
  console.log(`Faculties: ${profile.faculties.join(', ')}`);
  console.log(`Oracles: ${profile.oracles.join(', ')}`);
  console.log(`Packs: ${profile.packs.join(', ')}`);
  console.log('');

  const readline = await import('node:readline/promises');
  const { stdin: input, stdout: output } = process;
  const rl = readline.createInterface({ input, output });

  console.log('Type "help" for commands, "exit" to quit.\n');

  const genome = createGenomeRegistry();

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
      listProfiles();
      continue;
    }

    if (trimmed === 'packs') {
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

/** Generate schema artifacts. */
async function generateSchema(schemaId: string): Promise<void> {
  const genome = createGenomeRegistry();
  const schema = genome.get(schemaId);

  if (!schema) {
    console.log(`Schema not found: ${schemaId}`);
    console.log('Available schemas:', genome.getAll().map((s) => s.id).join(', '));
    return;
  }

  console.log(`Generating artifacts for: ${schema.name} (${schema.id})`);
  await genome.generate(schemaId);
  console.log('Generated:');
  console.log(`  - ${schema.id}.types.ts`);
  console.log(`  - ${schema.id}.log-codec.ts`);
  console.log(`  - ${schema.id}.mcp-tool.ts`);
  console.log(`  - ${schema.id}.elicitation.json`);
  console.log(`  - ${schema.id}.fuzzer.test.ts`);
  console.log(`  - ${schema.id}.md`);
  console.log(`  - ${schema.id}.json-schema.json`);
}

/** Show schema details. */
async function showSchema(schemaId: string): Promise<void> {
  const genome = createGenomeRegistry();
  const schema = genome.get(schemaId);

  if (!schema) {
    console.log(`Schema not found: ${schemaId}`);
    return;
  }

  console.log(`\nSchema: ${schema.name} (${schema.id})`);
  console.log(`Description: ${schema.description ?? 'none'}`);
  console.log(`Version: ${schema.version ?? '1.0.0'}`);
  console.log(`Tags: ${schema.tags?.join(', ') ?? 'none'}`);

  if (schema.mcpTool) {
    console.log(`MCP Tool: ${schema.mcpTool.name} - ${schema.mcpTool.description}`);
  }

  if (schema.elicitation) {
    console.log(`Elicitation: ${schema.elicitation.title}`);
  }

  const artifacts = await genome.generate(schemaId);
  console.log('\nJSON Schema:');
  console.log(JSON.stringify(artifacts.jsonSchema, null, 2));
}

/** Default: run agent with profile. */
async function runAgentMode(profileKind: string): Promise<void> {
  const registry = createProfileRegistry();
  const profile = registry.get(profileKind);

  if (!profile) {
    console.error(`Unknown profile: ${profileKind}`);
    process.exit(1);
  }

  console.log(`Starting SeNARS with profile: ${profile.name} (${profile.kind})`);

  if (profile.requiresLM) {
    const envConfig = readAppEnvConfig();
    if (!envConfig.enableWebUI) {
      console.warn('Warning: Profile requires LM but no LM configured. Set LM_API_KEY or LM_ENDPOINT.');
    }
  }

  const { agent } = await createAgentFromEnv({ narConfig: { maxConcepts: 100 } });
  await runAgent(agent);

  await maybeStartWebUI(agent, readAppEnvConfig().enableWebUI, undefined, logger);
}

/** Main entry point. */
async function main(): Promise<void> {
  const { sections } = buildHelpSections();
  const { parseFlags } = await import('@senars/util/cli');
  const flags = parseCommonFlags(parseFlags());

  // Parse custom flags (convert kebab-case to camelCase for Zod schema)
  const argv = process.argv.slice(2);
  const customArgs: Record<string, unknown> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      let key = arg.slice(2);
      // Convert kebab-case to camelCase
      key = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        customArgs[key] = nextArg;
        i++;
      } else {
        customArgs[key] = true;
      }
    }
  }

  // Convert string values
  if (customArgs.mcpPort) customArgs.mcpPort = parseInt(String(customArgs.mcpPort), 10);
  if (customArgs.generate) customArgs.generate = String(customArgs.generate);
  if (customArgs.schema) customArgs.schema = String(customArgs.schema);

  const parsed = CLISchema.parse(customArgs);

  if (flags.help) {
    showHelpAndExit(sections);
  }

  if (parsed.listProfiles) {
    listProfiles();
    return;
  }

  if (parsed.listPacks) {
    listPacks();
    return;
  }

  if (parsed.generate) {
    await generateSchema(parsed.generate);
    return;
  }

  if (parsed.schema) {
    await showSchema(parsed.schema);
    return;
  }

  if (parsed.mcp) {
    await startMCPServer(parsed.mcpPort);
    return;
  }

  if (parsed.playground) {
    await startPlayground(flags.profile);
    return;
  }

  // Default: run agent with profile
  const profileKind = flags.profile ?? 'agent';
  await runAgentMode(profileKind);
}

runEntrypoint(main);