import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readAppEnvConfig } from '../../src/bin/lib/env-config.js';
import { loadConfig } from '../../src/config/loader.js';
import { validateEnv } from '../../src/utils/env-validate.js';

const MAPPED = [
  'SENARS_LM_ENABLED',
  'SENARS_LM_PROVIDER',
  'SENARS_LM_MODEL',
  'SENARS_SENARS_ENABLED',
] as const;

const PROBED = [
  'SENARS_MCP_ENABLED',
  'SENARS_IRC_PORT',
  'REASONING_THRESHOLD',
  'SENARS_TOTALLY_MADE_UP',
  'ENABLE_WEB_UI',
  'LM_LLAMACPP_DEBUG',
  'SENARS_GAME_TRACE',
] as const;

const saved = new Map<string, string | undefined>();

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
});

const setEnv = (key: string, value: string): void => {
  if (!saved.has(key)) saved.set(key, process.env[key]);
  process.env[key] = value;
};

const withConfigFile = async (
  body: Record<string, unknown>,
  run: (path: string) => Promise<void>
): Promise<void> => {
  const dir = await mkdtemp(join(tmpdir(), 'senars-loader-'));
  try {
    const path = join(dir, 'senars.config.json');
    await writeFile(path, JSON.stringify({ configVersion: '2.0', ...body }));
    await run(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

describe('loadConfig: env overrides merge into the file, they do not replace it', () => {
  it('keeps the siblings of an overridden capability the file had set', async () => {
    await withConfigFile(
      { capabilities: { senars: { memoryFile: 'from-file.json', maxConcepts: 42 } } },
      async (path) => {
        for (const key of MAPPED) delete process.env[key];
        setEnv('SENARS_LM_MODEL', 'mock-model');
        const config = await loadConfig(path);
        expect(config.capabilities.lm.model).toBe('mock-model');
        // The regression: a flat spread replaced `capabilities` wholesale and
        // these two file-configured values vanished.
        expect(config.capabilities.senars.memoryFile).toBe('from-file.json');
        expect(config.capabilities.senars.maxConcepts).toBe(42);
      }
    );
  });

  it('lets a mapped var win over the file, and leaves the file alone when unset', async () => {
    await withConfigFile({ capabilities: { senars: { memoryFile: 'from-file.json' } } }, async (path) => {
      for (const key of MAPPED) delete process.env[key];
      expect((await loadConfig(path)).capabilities.senars.memoryFile).toBe('from-file.json');

      setEnv('SENARS_SENARS_ENABLED', 'off');
      expect((await loadConfig(path)).capabilities.senars.enabled).toBe(false);
      expect((await loadConfig(path)).capabilities.senars.memoryFile).toBe('from-file.json');
    });
  });
});

describe('validateEnv', () => {
  it('accepts the boolean grammar the rest of the system reads', () => {
    for (const key of PROBED) delete process.env[key];
    setEnv('SENARS_MCP_ENABLED', 'on');
    setEnv('SENARS_IRC_PORT', '6697');
    setEnv('REASONING_THRESHOLD', '0.55');
    const { mistyped } = validateEnv();
    expect(mistyped).toEqual([]);
  });

  it('rejects a fraction where an int is declared, and junk where a number is', () => {
    for (const key of PROBED) delete process.env[key];
    setEnv('SENARS_IRC_PORT', '6697.5');
    setEnv('REASONING_THRESHOLD', 'high');
    const { mistyped } = validateEnv();
    expect(mistyped).toEqual([
      { name: 'REASONING_THRESHOLD', reason: 'expected number, got "high"' },
      { name: 'SENARS_IRC_PORT', reason: 'expected int, got "6697.5"' },
    ]);
  });

  it('separates a var we do not know from one that is mistyped', () => {
    for (const key of PROBED) delete process.env[key];
    setEnv('SENARS_TOTALLY_MADE_UP', 'x');
    setEnv('SENARS_MCP_ENABLED', 'perhaps');
    const { unknown, mistyped } = validateEnv();
    expect(unknown).toEqual(['SENARS_TOTALLY_MADE_UP']);
    expect(mistyped).toEqual([
      {
        name: 'SENARS_MCP_ENABLED',
        reason: 'expected boolean (true/false/1/0/yes/no/on/off), got "perhaps"',
      },
    ]);
  });

  it('declares a kind for every var the product code reads as a flag', () => {
    for (const key of PROBED) delete process.env[key];
    setEnv('ENABLE_WEB_UI', 'false');
    setEnv('LM_LLAMACPP_DEBUG', '0');
    setEnv('SENARS_GAME_TRACE', 'on');

    expect(validateEnv()).toMatchObject({ unknown: [], mistyped: [] });
  });

  it('reads a disabled flag as disabled — every spelling, including the falsy ones', () => {
    for (const key of PROBED) delete process.env[key];
    for (const value of ['false', '0', 'no', 'off', '']) {
      setEnv('ENABLE_WEB_UI', value);
      expect(readAppEnvConfig().enableWebUI).toBe(false);
    }
    for (const value of ['true', '1', 'yes', 'on']) {
      setEnv('ENABLE_WEB_UI', value);
      expect(readAppEnvConfig().enableWebUI).toBe(true);
    }
  });
});
