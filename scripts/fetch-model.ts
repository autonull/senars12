#!/usr/bin/env tsx
/**
 * Fetches the default GGUF model for embedded llama.cpp runtime.
 * Idempotent: resolves .models/<model>.gguf, downloads if missing.
 *
 * Uses node-llama-cpp's resolveModelFile which handles:
 * - Model resolution from Hugging Face Hub
 * - Quantization selection (prefers Q4_K_M for balance)
 * - Caching under .cache/llama.cpp
 * - Progress reporting
 *
 * Usage:
 *   pnpm exec tsx scripts/fetch-model.ts
 *   LM_LLAMACPP_MODEL=custom-model.gguf pnpm exec tsx scripts/fetch-model.ts
 */

import { resolveModelFile, getLlama, type LlamaModel } from 'node-llama-cpp';
import { existsSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const MODELS_DIR = join(PROJECT_ROOT, '.models');
const CACHE_DIR = join(PROJECT_ROOT, '.cache', 'llama.cpp');

/** Default compact model: small, fast, good quality for CPU/GPU. */
const DEFAULT_MODEL_SPEC = {
  // Qwen2.5-1.5B is a strong compact model; node-llama-cpp will pick Q4_K_M
  model: 'onnx-community/Qwen2.5-1.5B-Instruct-GGUF',
  // Explicitly request Q4_K_M quantization for speed/quality balance
  quantization: 'Q4_K_M',
} as const;

interface FetchOptions {
  modelSpec?: { model: string; quantization?: string };
  modelsDir?: string;
  cacheDir?: string;
  force?: boolean;
  dryRun?: boolean;
}

async function fetchModel(options: FetchOptions = {}): Promise<string> {
  const {
    modelSpec = DEFAULT_MODEL_SPEC,
    modelsDir = MODELS_DIR,
    cacheDir = CACHE_DIR,
    force = false,
    dryRun = false,
  } = options;

  console.log(`📦 Fetching model: ${modelSpec.model} (${modelSpec.quantization ?? 'auto'})`);
  console.log(`   Models dir: ${modelsDir}`);
  console.log(`   Cache dir:  ${cacheDir}`);

  if (!existsSync(modelsDir)) {
    mkdirSync(modelsDir, { recursive: true });
    console.log(`   Created models directory`);
  }

  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
    console.log(`   Created cache directory`);
  }

  try {
    // Use node-llama-cpp's resolveModelFile to download/resolve the model
    // This handles HF Hub resolution, quantization selection, and caching
    const modelPath = await resolveModelFile(modelSpec.model, {
      directory: cacheDir,
      download: "auto",
      progressCallback: (progress: number) => {
        const pct = (progress * 100).toFixed(1);
        process.stdout.write(`\r   Downloading: ${pct}%`);
      },
    });

    console.log(`\n   Resolved to: ${modelPath}`);

    // Copy/link to .models/ for easy access
    const targetName = basename(modelPath);
    const targetPath = join(modelsDir, targetName);

    if (existsSync(targetPath) && !force) {
      console.log(`   ✅ Already exists at ${targetPath}`);
      return targetPath;
    }

    if (dryRun) {
      console.log(`   [dry-run] Would copy to ${targetPath}`);
      return targetPath;
    }

    // Copy the model file to .models/
    cpSync(modelPath, targetPath, { force: true });
    console.log(`   ✅ Copied to ${targetPath}`);

    return targetPath;
  } catch (error) {
    console.error(`   ❌ Failed to fetch model: ${error}`);
    throw error;
  }
}

/** Validates that a model file exists and is loadable by llama.cpp */
async function validateModel(modelPath: string): Promise<boolean> {
  try {
    const llama = await getLlama();
    const model = await llama.loadModel({ modelPath });
    await model.dispose();
    return true;
  } catch {
    return false;
  }
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force') || args.includes('-f');
  const dryRun = args.includes('--dry-run');
  const validate = args.includes('--validate');
  const modelArg = args.find((a) => a.startsWith('--model='))?.split('=')[1];
  const quantArg = args.find((a) => a.startsWith('--quant='))?.split('=')[1];

  const modelSpec = modelArg
    ? { model: modelArg, quantization: quantArg }
    : DEFAULT_MODEL_SPEC;

  const envModel = process.env.LM_LLAMACPP_MODEL;
  if (envModel && !modelArg) {
    console.log(`📋 Using model from LM_LLAMACPP_MODEL: ${envModel}`);
    // If it's a local path, just validate it
    if (existsSync(envModel)) {
      if (validate) {
        const ok = await validateModel(envModel);
        console.log(ok ? '✅ Model validation passed' : '❌ Model validation failed');
        process.exit(ok ? 0 : 1);
      }
      console.log(`✅ Using local model: ${envModel}`);
      process.exit(0);
    }
  }

  try {
    const modelPath = await fetchModel({ modelSpec, force, dryRun });

    if (validate) {
      console.log(`\n🔍 Validating model...`);
      const ok = await validateModel(modelPath);
      console.log(ok ? '✅ Model validation passed' : '❌ Model validation failed');
      process.exit(ok ? 0 : 1);
    }

    console.log(`\n✅ Model ready: ${modelPath}`);
    console.log(`   Set LM_LLAMACPP_MODEL=${modelPath} to use it`);
  } catch (error) {
    console.error(`\n❌ Fetch failed: ${error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});