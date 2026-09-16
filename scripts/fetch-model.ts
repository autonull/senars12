#!/usr/bin/env tsx
/**
 * Fetches GGUF models for the embedded llama.cpp runtime into .models/.
 * Idempotent: resolves each spec to a local file, downloading if missing.
 *
 * Usage:
 *   pnpm exec tsx scripts/fetch-model.ts [--model=qwen|gemma|<hf-uri>] [--validate] [--dry-run] [--force]
 */

import { resolveModelFile, getLlama } from 'node-llama-cpp';
import { existsSync, mkdirSync, cpSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const MODELS_DIR = join(PROJECT_ROOT, '.models');
const CACHE_DIR = join(PROJECT_ROOT, '.cache', 'llama.cpp');

/** Compact instruction models: small, fast, common-denominator for edge CPU/GPU. */
const MODEL_SPECS = {
  qwen: {
    uri: 'hf:ggml-org/Qwen3.5-0.8B-GGUF/Qwen3.5-0.8B-Q4_0.gguf',
    envModel: 'Qwen3.5-0.8B-Q4_0.gguf',
  },
  gemma: {
    uri: 'hf:google/gemma-4-E2B-it-qat-q4_0-gguf/gemma-4-E2B_q4_0-it.gguf',
    envModel: 'gemma-4-E2B_q4_0-it.gguf',
  },
} as const;

type SpecKey = keyof typeof MODEL_SPECS;

const resolveSpec = (arg?: string): string => {
  if (!arg || arg === 'all') return Object.values(MODEL_SPECS)[0].uri;
  const spec = MODEL_SPECS[arg as SpecKey];
  if (spec) return spec.uri;
  return arg.startsWith('hf:') || arg.startsWith('https://') ? arg : `hf:${arg}`;
};

const fetchModel = async (uri: string, force: boolean, dryRun: boolean): Promise<string> => {
  for (const dir of [MODELS_DIR, CACHE_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  const modelPath = await resolveModelFile(uri, {
    directory: CACHE_DIR,
    onProgress: ({ totalSize, downloadedSize }: { totalSize: number; downloadedSize: number }) => {
      if (totalSize > 0) {
        const pct = ((downloadedSize / totalSize) * 100).toFixed(1);
        process.stdout.write(`\r   Downloading: ${pct}%  (${(downloadedSize / 1e9).toFixed(2)}/${(totalSize / 1e9).toFixed(2)} GB)`);
      }
    },
  });
  console.log(`\n   Resolved: ${modelPath}`);

  const targetPath = join(MODELS_DIR, uri.split('/').pop() ?? basename(modelPath));
  if (existsSync(targetPath) && !force) {
    console.log(`   ✅ Already at ${targetPath}`);
    return targetPath;
  }
  if (dryRun) {
    console.log(`   [dry-run] Would copy to ${targetPath}`);
    return modelPath;
  }
  cpSync(modelPath, targetPath, { force: true });
  console.log(`   ✅ Copied to ${targetPath}`);
  return targetPath;
};

const validateModel = async (modelPath: string): Promise<boolean> => {
  try {
    const llama = await getLlama();
    const model = await llama.loadModel({ modelPath });
    await model.dispose();
    return true;
  } catch {
    return false;
  }
};

const main = async () => {
  const args = process.argv.slice(2);
  const force = args.includes('--force') || args.includes('-f');
  const dryRun = args.includes('--dry-run');
  const validate = args.includes('--validate');
  const modelArg = args.find((a) => a.startsWith('--model='))?.split('=')[1];
  const uris = !modelArg || modelArg === 'all'
    ? Object.values(MODEL_SPECS).map((s) => s.uri)
    : [resolveSpec(modelArg)];

  for (const uri of uris) {
    console.log(`📦 Fetching: ${uri}`);
    const modelPath = await fetchModel(uri, force, dryRun);
    if (validate) {
      const ok = await validateModel(modelPath);
      console.log(ok ? '✅ Model validation passed' : '❌ Model validation failed');
      if (!ok) process.exitCode = 1;
    } else {
      console.log(`   Set LM_LLAMACPP_MODEL=${modelPath}`);
    }
  }
};

main().catch((err) => {
  console.error(`❌ Fetch failed: ${err}`);
  process.exit(1);
});
