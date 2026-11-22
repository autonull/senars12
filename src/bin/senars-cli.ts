#!/usr/bin/env tsx
/**
 * `pnpm senars` / `npx senars` — unified CLI entry point.
 *
 * Profiles as data: logic, coprocessor, agent, device (+ domain packs).
 * Device profile imports zero LM.
 */

import { createProfileRegistry, type ProfileConfig, PROFILE_KINDS, getAllDomainPacks } from '../profiles/index.js';
import { createGenomeRegistry, type GenomeSchema } from '../genome/index.js';
import { createGeneratedMCPServer, type GeneratedMCPServerConfig } from '../surface/mcp/generated-server.js';
import { z } from 'zod';
import { readAppEnvConfig } from './lib/env-config.js';
import { createAgentFromEnv, runAgent } from './lib/lifecycle.js';

/** CLI arguments schema. */
const CLISchema = z.object({
  profile: z.enum(PROFILE_KINDS).optional(),
  listProfiles: z.boolean().optional(),
  listPacks: z.boolean().optional(),
  mcp: z.boolean().optional(),
  mcpPort: z.number().optional(),
  playground: z.boolean().optional(),
  generate: z.string().optional(),
  schema: z.string().optional(),
  help: z.boolean().optional(),
});

/** Parse CLI args. */
function parseArgs(argv: string[]): z.infer<typeof CLISchema> {
  const args: Record<string, unknown> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        args[key] = nextArg;
        i++;
      } else {
        args[key] = true;
      }
    }
  }

  // Convert string values
  if (args.profile) args.profile = String(args.profile);
  if (args.mcpPort) args.mcpPort = parseInt(String(args.mcpPort), 10);
  if (args.generate) args.generate = String(args.generate);
  if (args.schema) args.schema = String(args.schema);

  return CLISchema.parse(args);
}

/** Show help. */
function showHelp(): void {
  console.log(`
SeNARS — The Fold: One deterministic fold over one log

Usage: senars [options]

Profiles:
  --profile <kind>       Select profile: logic | coprocessor | agent | device
  --list-profiles        List available profiles
  --list-packs           List available domain packs

MCP Server:
  --mcp                  Start MCP server (stdio by default)
  --mcp-port <port>      Start MCP server on HTTP port

Playground:
  --playground           Start interactive playground

Generation:
  --generate <schema-id> Generate artifacts for schema
  --schema <schema-id>   Show schema details

General:
  --help                 Show this help

Examples:
  senars --profile logic
  senars --profile agent --mcp
  senars --profile device --playground
  senars --generate my-schema
  npx senars --profile coprocessor
`);
}

/** List profiles. */
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

  // Register some example schemas
  genome.register({
    id: 'task',
    name: 'Task',
    schema: z.object({
      id: z.string(),
      description: z.string(),
      priority: z.number().min(0).max(10),
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
      truth: z.object({ f: z.number().min(0).max(1), c: z.number().min(0).max(1) }),
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
    // HTTP server implementation would go here
    console.log(`MCP server starting on http://localhost:${port}`);
    console.log('HTTP transport not yet implemented - use stdio mode');
  } else {
    console.log('MCP server starting on stdio');
    console.log('Stdio transport not yet fully implemented');
  }
}

/** Start playground. */
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

  // Interactive REPL would go here
  console.log('Playground REPL not yet implemented.');
  console.log('Try: senars --profile logic --mcp');
}

/** Generate schema artifacts. */
async function generateSchema(schemaId: string): Promise<void> {
  const genome = createGenomeRegistry();

  // Check if schema exists
  const schema = genome.get(schemaId);
  if (!schema) {
    console.log(`Schema not found: ${schemaId}`);
    console.log('Available schemas:', genome.getAll().map(s => s.id).join(', '));
    return;
  }

  console.log(`Generating artifacts for: ${schema.name} (${schema.id})`);
  const artifacts = await genome.generate(schemaId);
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
function showSchema(schemaId: string): void {
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

  // Show JSON schema
  const artifacts = genome.generate(schemaId);
  console.log('\nJSON Schema:');
  console.log(JSON.stringify(artifacts.then(a => a.jsonSchema), null, 2));
}

/** Main entry point. */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    showHelp();
    return;
  }

  if (args.listProfiles) {
    listProfiles();
    return;
  }

  if (args.listPacks) {
    listPacks();
    return;
  }

  if (args.generate) {
    await generateSchema(args.generate);
    return;
  }

  if (args.schema) {
    showSchema(args.schema);
    return;
  }

  if (args.mcp) {
    await startMCPServer(args.mcpPort);
    return;
  }

  if (args.playground) {
    await startPlayground(args.profile);
    return;
  }

  // Default: run agent with profile
  const profileKind = args.profile ?? 'agent';
  const registry = createProfileRegistry();
  const profile = registry.get(profileKind);

  if (!profile) {
    console.error(`Unknown profile: ${profileKind}`);
    process.exit(1);
  }

  console.log(`Starting SeNARS with profile: ${profile.name} (${profile.kind})`);

  if (profile.requiresLM) {
    const envConfig = readAppEnvConfig();
    if (!envConfig.lmApiKey && !envConfig.lmEndpoint) {
      console.warn('Warning: Profile requires LM but no LM configured. Set LM_API_KEY or LM_ENDPOINT.');
    }
  }

  const { agent } = await createAgentFromEnv({ narConfig: { maxConcepts: 100 } });
  await runAgent(agent);

  if (readAppEnvConfig().enableWebUI) {
    const { startAgentUI } = await import('../../ui/src/server/index.js');
    await startAgentUI(agent as never)
      .then(() => console.log('UI at http://localhost:8765'))
      .catch((err: unknown) => console.error('Web UI failed to start', err));
  } else {
    console.log('SeNARS running (no UI; set ENABLE_WEB_UI=true to serve one).');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});