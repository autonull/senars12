#!/usr/bin/env tsx

/**
 * `senars config validate` — validate senars.config.json against the schema.
 *
 * Usage:
 *   senars config validate                    # validate default config path
 *   senars config validate --config path.json # validate specific config file
 *   senars config validate --json             # output machine-readable JSON
 *
 * @deprecated Use `senars config validate` instead. This entry point will be removed in a future version.
 */

import { createLogger } from '@senars/util/logger';

// Deprecation warning
const logger = createLogger({ scope: 'config-validate' });
logger.warn('DEPRECATION: `senars config validate` (standalone) is deprecated. Use `senars config validate` via the unified CLI instead.');

import { resolveLMConfig, resolveLMSettings } from '@senars/lm';
import { errMsg } from '@senars/util/error';
import { appConfigSchema, loadConfig } from '@senars/config';
import { runEntrypoint } from './lib/fatal-error';
import { runCLI, standardSections, type CommonFlags, type HelpSection } from './lib/cli-utils';

interface ValidateOptions {
  configPath?: string;
  jsonOutput: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
    code: string;
  }>;
  config?: unknown;
  effectiveConfig?: unknown;
}

const sections: HelpSection[] = [
  standardSections.usage('senars config validate', 'Validate senars.config.json against the schema'),
  {
    title: 'Options',
    lines: [
      '--config <path>          Validate specific config file (default: auto-discover)',
      '--json                   Output machine-readable JSON',
      '-v, --version            Show version',
      '--verbose                Verbose output',
      '--quiet                  Suppress non-error output',
      '-h, --help               Show this help',
    ],
  },
  standardSections.examples([
    'senars config validate',
    'senars config validate --config ./my-config.json',
    'senars config validate --json',
  ]),
];

async function main(flags: CommonFlags): Promise<void> {
  const { parseFlags } = await import('@senars/util/cli');
  const imgFlags = parseFlags();

  const configPath = imgFlags.str('--config', '').trim() || undefined;
  const jsonOutput = flags.json || imgFlags.has('--json');

  const result: ValidationResult = {
    valid: false,
    errors: [],
  };

  try {
    // Load and validate config
    let config: import('../config/index').AppConfig;
    if (configPath) {
      // Load from specific path
      const { readFile } = await import('node:fs/promises');
      const content = await readFile(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      config = appConfigSchema.parse(parsed);
    } else {
      // Load using default loader (which handles env overrides)
      config = await loadConfig();
    }

    result.valid = true;
    result.config = config;

    // Also resolve effective LM config
    const lmSettings = resolveLMSettings();
    const lmConfig = resolveLMConfig();
    result.effectiveConfig = { lm: lmConfig, lmSettings };

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('✓ Configuration is valid');
      console.log(`  Profile: ${config.profile.name}`);
      console.log(`  LM Provider: ${lmConfig.provider}`);
      console.log(`  LM Model: ${lmConfig.model}`);
      console.log(`  NAR Enabled: ${config.backends.nar.enabled}`);
      console.log(`  Config Version: ${config.configVersion ?? 'not set'}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      // Try to extract Zod error details
      if ('issues' in error) {
        const zodError = error as {
          issues: Array<{ path: (string | number)[]; message: string; code: string }>;
        };
        result.errors = zodError.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
          code: issue.code,
        }));
      } else {
        result.errors = [{ path: '', message: error.message, code: 'validation_error' }];
      }
    } else {
      result.errors = [{ path: '', message: errMsg(error), code: 'unknown_error' }];
    }

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('✗ Configuration validation failed');
      for (const err of result.errors) {
        console.log(`  ${err.path ? `[${err.path}] ` : ''}${err.message}`);
      }
    }
    process.exit(1);
  }
}

runEntrypoint(() => runCLI(main, { sections, version: '0.0.0' }));