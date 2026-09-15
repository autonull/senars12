#!/usr/bin/env tsx
/**
 * `senars config validate` — validate senars.config.json against the schema.
 *
 * Usage:
 *   senars config validate                    # validate default config path
 *   senars config validate --config path.json # validate specific config file
 *   senars config validate --json             # output machine-readable JSON
 */

import { createLogger } from '@senars/nar/logger';
import { appConfigSchema, loadConfig } from '../config/index.js';
import { resolveLMSettings, resolveLMConfig } from '@senars/nar/lm';

const logger = createLogger({ scope: 'config:validate' });

interface ValidateOptions {
  configPath?: string;
  jsonOutput: boolean;
}

function parseArgs(): ValidateOptions {
  const args = process.argv.slice(2);
  const configIndex = args.indexOf('--config');
  const configPath = configIndex >= 0 && args[configIndex + 1] ? args[configIndex + 1] : undefined;
  const jsonOutput = args.includes('--json');
  return { configPath, jsonOutput };
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

async function main(): Promise<void> {
  const { configPath, jsonOutput } = parseArgs();

  const result: ValidationResult = {
    valid: false,
    errors: [],
  };

  try {
    // Load and validate config
    let config: import('../config/index.js').AppConfig;
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
        const zodError = error as { issues: Array<{ path: (string | number)[]; message: string; code: string }> };
        result.errors = zodError.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
          code: issue.code,
        }));
      } else {
        result.errors = [{ path: '', message: error.message, code: 'validation_error' }];
      }
    } else {
      result.errors = [{ path: '', message: String(error), code: 'unknown_error' }];
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

main().catch((err) => {
  logger.error('config validate failed', err as Error);
  process.exit(1);
});