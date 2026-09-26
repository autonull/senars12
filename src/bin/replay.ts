#!/usr/bin/env tsx
/**
 * `senars replay` — deterministic event log replay with verification.
 *
 * Usage:
 *   pnpm replay --from <eventId> --to <eventId> --verify
 *   pnpm replay --from 0 --to 1000 --output replay-snapshot.json
 *   pnpm replay --verify --snapshot replay-snapshot.json
 *
 * Replays gate events and derivation records into a fresh Memory,
 * optionally verifying the final state hash matches a recorded snapshot.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createLogger } from '@senars/core/logger';
import { Memory } from '@senars/nar/memory';
import { replayIntoMemory, serializeReplayResult, type FullReplayOptions, type ReplayResult } from '@senars/nar/kernel/replay';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = createLogger({ scope: 'replay' });

interface ReplayCliOptions {
  from?: string;
  to?: string;
  verify?: boolean;
  snapshot?: string;
  output?: string;
  gateEventsPath?: string;
  derivationRecordsPath?: string;
  memoryConfig?: Record<string, unknown>;
}

function parseArgs(argv: string[]): ReplayCliOptions {
  const opts: ReplayCliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--from' || arg === '-f') {
      opts.from = argv[++i];
    } else if (arg === '--to' || arg === '-t') {
      opts.to = argv[++i];
    } else if (arg === '--verify' || arg === '-v') {
      opts.verify = true;
    } else if (arg === '--snapshot' || arg === '-s') {
      opts.snapshot = argv[++i];
    } else if (arg === '--output' || arg === '-o') {
      opts.output = argv[++i];
    } else if (arg === '--gate-events') {
      opts.gateEventsPath = argv[++i];
    } else if (arg === '--derivation-records') {
      opts.derivationRecordsPath = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }
  return opts;
}

function printUsage(): void {
  console.log(`
SeNARS Deterministic Replay CLI

Usage:
  pnpm replay --from <eventId> --to <eventId> [options]

Options:
  -f, --from <eventId>         Starting event ID (inclusive) or "0" for beginning
  -t, --to <eventId>           Ending event ID (inclusive) or "end" for all
  -v, --verify                 Verify final state hash against snapshot
  -s, --snapshot <path>        Path to snapshot file for verification
  -o, --output <path>          Output path for snapshot (default: stdout)
  --gate-events <path>         Gate events JSONL file (default: .cache/events/gate-events.jsonl)
  --derivation-records <path>  Derivation records JSONL file (default: .cache/events/derivations.jsonl)
  -h, --help                   Show this help

Examples:
  pnpm replay --from 0 --to 1000 --verify
  pnpm replay --from 0 --to end --output snapshot.json
  pnpm replay --verify --snapshot snapshot.json
`);
}

function computeStateHash(result: ReplayResult): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({
    appliedTasks: result.appliedTasks,
    appliedRevisions: result.appliedRevisions,
    appliedDerivations: result.appliedDerivations,
    appliedActivations: result.appliedActivations,
    skipped: result.skipped,
    errors: result.errors,
    gateSnapshot: result.gateSnapshot,
  }));
  return hash.digest('hex');
}

async function runReplay(opts: ReplayCliOptions): Promise<void> {
  const projectRoot = resolve(__dirname, '../../..');
  const gateEventsPath = opts.gateEventsPath ?? join(projectRoot, '.cache/events/gate-events.jsonl');
  const derivationRecordsPath = opts.derivationRecordsPath ?? join(projectRoot, '.cache/events/derivations.jsonl');

  if (!existsSync(gateEventsPath)) {
    logger.error(`Gate events file not found: ${gateEventsPath}`);
    process.exit(1);
  }

  logger.info('Starting replay', { from: opts.from, to: opts.to, gateEventsPath });

  const replayOpts: FullReplayOptions = {
    gateEventsPath,
    derivationRecordsPath: existsSync(derivationRecordsPath) ? derivationRecordsPath : undefined,
    memoryConfig: opts.memoryConfig as FullReplayOptions['memoryConfig'],
  };

  const result = await replayIntoMemory(replayOpts);
  const stateHash = computeStateHash(result);

  logger.info('Replay completed', {
    appliedTasks: result.appliedTasks,
    appliedRevisions: result.appliedRevisions,
    appliedDerivations: result.appliedDerivations,
    appliedActivations: result.appliedActivations,
    skipped: result.skipped,
    errors: result.errors.length,
    stateHash,
  });

  if (opts.verify) {
    if (!opts.snapshot) {
      logger.error('--verify requires --snapshot <path>');
      process.exit(1);
    }
    if (!existsSync(opts.snapshot)) {
      logger.error(`Snapshot file not found: ${opts.snapshot}`);
      process.exit(1);
    }
    const snapshot = JSON.parse(readFileSync(opts.snapshot, 'utf8'));
    const expectedHash = snapshot.stateHash;
    if (stateHash === expectedHash) {
      logger.info('VERIFICATION PASSED: State hash matches snapshot');
      console.log('✅ VERIFICATION PASSED');
      process.exit(0);
    } else {
      logger.error('VERIFICATION FAILED: State hash mismatch', { expected: expectedHash, actual: stateHash });
      console.log('❌ VERIFICATION FAILED');
      console.log(`Expected: ${expectedHash}`);
      console.log(`Actual:   ${stateHash}`);
      process.exit(1);
    }
  }

  if (opts.output) {
    await serializeReplayResult(result, opts.output);
    logger.info(`Snapshot written to ${opts.output}`);
  } else {
    // Print summary to stdout
    console.log(`Replay Summary:`);
    console.log(`  Applied Tasks:        ${result.appliedTasks}`);
    console.log(`  Applied Revisions:    ${result.appliedRevisions}`);
    console.log(`  Applied Derivations:  ${result.appliedDerivations}`);
    console.log(`  Applied Activations:  ${result.appliedActivations}`);
    console.log(`  Skipped:              ${result.skipped}`);
    console.log(`  Errors:               ${result.errors.length}`);
    console.log(`  State Hash:           ${stateHash}`);
  }
}

const opts = parseArgs(process.argv.slice(2));
runReplay(opts).catch((err) => {
  logger.error('Replay failed', err instanceof Error ? err : undefined, { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});