#!/usr/bin/env tsx
/**
 * `pnpm senars` / `npx senars` — unified CLI entry point.
 *
 * Profiles as data: logic, coprocessor, agent, device (+ domain packs).
 * Device profile imports zero LM.
 */

import { z } from 'zod';
import { PROFILE_KINDS, getAllDomainPacks } from '../profiles/index';
import { standardSections, runCLI, profileHelpSection, showHelpAndExit, getProfileRegistry, type CommonFlags, type HelpSection } from './lib/cli-utils';
import { runEntrypoint } from './lib/fatal-error';
import { createAgentFromEnv, runAgent } from './lib/lifecycle';
import { readAppEnvConfig } from './lib/env-config';
import { maybeStartWebUI } from './lib/entrypoint-base';
import {
  listProfiles,
  listPacks,
  startMCPServer,
  startPlayground,
  generateSchema,
  showSchema,
} from './lib/senars-commands';
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
async function buildHelpSections(): Promise<HelpSection[]> {
  const registry = await getProfileRegistry();
  const profiles = registry.getAll();
  const profileInfos = profiles.map((p) => ({ kind: p.kind, name: p.name, description: p.description }));

  return [
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
}

/** Parse custom flags (kebab-case to camelCase for Zod schema). */
function parseCustomFlags(): Record<string, unknown> {
  const argv = process.argv.slice(2);
  const customArgs: Record<string, unknown> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      let key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        customArgs[key] = nextArg;
        i++;
      } else {
        customArgs[key] = true;
      }
    }
  }

  if (customArgs.mcpPort) customArgs.mcpPort = parseInt(String(customArgs.mcpPort), 10);
  if (customArgs.generate) customArgs.generate = String(customArgs.generate);
  if (customArgs.schema) customArgs.schema = String(customArgs.schema);

  return CLISchema.parse(customArgs);
}

/** Run agent with profile (default mode). */
async function runAgentMode(profileKind: string): Promise<void> {
  const registry = await getProfileRegistry();
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

/** Main entry point using shared CLI utilities. */
async function main(flags: CommonFlags): Promise<void> {
  const sections = await buildHelpSections();
  const parsed = parseCustomFlags();

  if (flags.help) {
    showHelpAndExit(sections);
  }

  if (parsed.listProfiles) {
    await listProfiles();
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

// Pre-build sections for runCLI's help check
let _cachedSections: HelpSection[] | null = null;
async function getCachedSections(): Promise<HelpSection[]> {
  if (!_cachedSections) {
    _cachedSections = await buildHelpSections();
  }
  return _cachedSections;
}

runEntrypoint(async () => {
  const sections = await getCachedSections();
  await runCLI(main, { sections, version: '0.0.0' });
});