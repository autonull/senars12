/**
 * Senars CLI sub-commands — extracted from senars.ts for reuse and testing.
 */

import { getProfileRegistry, getGenomeRegistry, registerDefaultMCPSchemas, formatProfileList, formatPackList } from './cli-utils';
import { getAllDomainPacks } from '../../profiles/index';
import { createGeneratedMCPServer, type GeneratedMCPServerConfig } from '../../surface/mcp/generated-server';
import { createLogger } from '@senars/util/logger';

const logger = createLogger({ scope: 'senars-commands' });

/** List available profiles. */
export async function listProfiles(): Promise<void> {
  const registry = await getProfileRegistry();
  const profiles = registry.getAll();
  console.log('\nAvailable Profiles:\n');
  console.log(formatProfileList(profiles));
}

/** List available domain packs. */
export function listPacks(): void {
  const packs = getAllDomainPacks();
  console.log('\nAvailable Domain Packs:\n');
  console.log(formatPackList(packs));
}

/** Start MCP server. */
export async function startMCPServer(port?: number): Promise<void> {
  const genome = await getGenomeRegistry();
  const profiles = await getProfileRegistry();

  await registerDefaultMCPSchemas(genome);

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

  createGeneratedMCPServer(config);

  if (port) {
    console.log(`MCP server starting on http://localhost:${port}`);
    console.log('HTTP transport not yet implemented - use stdio mode');
  } else {
    console.log('MCP server starting on stdio');
    console.log('Stdio transport not yet fully implemented');
  }
}

/** Start interactive playground REPL. */
export async function startPlayground(profileKind?: string): Promise<void> {
  console.log('\n🎮 SeNARS Playground\n');

  const registry = await getProfileRegistry();
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
      await listProfiles();
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
export async function generateSchema(schemaId: string): Promise<void> {
  const genome = await getGenomeRegistry();
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
export async function showSchema(schemaId: string): Promise<void> {
  const genome = await getGenomeRegistry();
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