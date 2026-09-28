#!/usr/bin/env tsx
/**
 * `senars replay` — deterministic event log replay with verification.
 *
 * Usage:
 *   pnpm replay --from <ordinal> --to <ordinal> --verify
 *   pnpm replay --from-id <uuid> --to-id <uuid> --verify
 *   pnpm replay --from 0 --to 1000 --output replay-snapshot.json
 *   pnpm replay --verify --snapshot replay-snapshot.json
 *
 * Replays gate events and derivation records into a fresh Memory,
 * optionally verifying the final state hash matches a recorded snapshot.
 * Gate events carry `id` (UUID), so --from-id/--to-id address event identities.
 * --from/--to address log ordinals (fallback for old logs without IDs).
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createLogger } from '@senars/core/logger';
import {
  computeReplayStateHash,
  replayIntoMemory,
  serializeReplayResult,
  verifyReplayStateHash,
  type FullReplayOptions,
  type ReplaySnapshotFile,
} from '@senars/nar/kernel/replay';
import { errMsg, parseFlags } from '@senars/util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = createLogger({ scope: 'replay' });

interface ReplayCliOptions {
  from?: number;
  to?: number;
  fromId?: string;
  toId?: string;
  verify?: boolean;
  snapshot?: string;
  output?: string;
  gateEventsPath?: string;
  derivationRecordsPath?: string;
  memoryConfig?: Record<string, unknown>;
}

const ORDINAL = /^\d+$/;

function parseOrdinal(raw: string | undefined, flag: string): number | undefined {
  if (raw === undefined) return undefined;
  if (raw === 'end' || raw === 'last') return undefined;
  if (!ORDINAL.test(raw)) {
    logger.error(`Invalid ${flag} ordinal: ${raw} (expected a non-negative integer or "end")`);
    process.exit(1);
  }
  return Number(raw);
}

function parseArgs(argv: string[]): ReplayCliOptions {
  const flags = parseFlags(argv);
  const str = (flag: string, alias?: string): string | undefined =>
    flags.str(flag, alias ? flags.str(alias, '') : '') || undefined;
  if (flags.has('--help', '-h')) {
    printUsage();
    process.exit(0);
  }
  return {
    from: parseOrdinal(str('--from', '-f'), '--from'),
    to: parseOrdinal(str('--to', '-t'), '--to'),
    fromId: str('--from-id'),
    toId: str('--to-id'),
    verify: flags.has('--verify', '-v'),
    snapshot: str('--snapshot', '-s'),
    output: str('--output', '-o'),
    gateEventsPath: str('--gate-events'),
    derivationRecordsPath: str('--derivation-records'),
  };
}

function printUsage(): void {
  console.log(`
SeNARS Deterministic Replay CLI

Usage:
  pnpm replay --from <ordinal> --to <ordinal> [options]
  pnpm replay --from-id <uuid> --to-id <uuid> [options]

Options:
  -f, --from <ordinal>       Starting gate-event ordinal (inclusive), or "0" for beginning
  -t, --to <ordinal>         Ending gate-event ordinal (inclusive) or "end" for all
      --from-id <uuid>       Starting gate-event ID (UUID) — preferred over ordinals
      --to-id <uuid>         Ending gate-event ID (UUID) — preferred over ordinals
  -v, --verify                 Verify final state hash against snapshot
  -s, --snapshot <path>        Path to snapshot file for verification
  -o, --output <path>          Output path for snapshot (default: stdout)
  --gate-events <path>         Gate events JSONL file (default: .cache/events/gate-events.jsonl)
  --derivation-records <path>  Derivation records JSONL file (default: .cache/events/derivations.jsonl)
  -h, --help                   Show this help

Examples:
  pnpm replay --from 0 --to 1000 --verify
  pnpm replay --from-id 0192f0c... --to-id 0192f1a... --verify
  pnpm replay --from 0 --to end --output snapshot.json
  pnpm replay --verify --snapshot snapshot.json
`);
}

async function runReplay(opts: ReplayCliOptions): Promise<void> {
  const projectRoot = resolve(__dirname, '../../..');
  const gateEventsPath = opts.gateEventsPath ?? join(projectRoot, '.cache/events/gate-events.jsonl');
  const derivationRecordsPath = opts.derivationRecordsPath ?? join(projectRoot, '.cache/events/derivations.jsonl');

  if (!existsSync(gateEventsPath)) {
    logger.error(`Gate events file not found: ${gateEventsPath}`);
    process.exit(1);
  }

  const rangeInfo = opts.fromId ? { fromId: opts.fromId, toId: opts.toId } : { from: opts.from, to: opts.to };
  logger.info('Starting replay', { ...rangeInfo, gateEventsPath });

  const replayOpts: FullReplayOptions = {
    gateEventsPath,
    derivationRecordsPath: existsSync(derivationRecordsPath) ? derivationRecordsPath : undefined,
    memoryConfig: opts.memoryConfig as FullReplayOptions['memoryConfig'],
    range: { from: opts.from, to: opts.to },
    idRange: opts.fromId ? { from: opts.fromId, to: opts.toId } : undefined,
  };

  const result = await replayIntoMemory(replayOpts);
  const stateHash = await computeReplayStateHash(result);

  logger.info('Replay completed', {
    ...rangeInfo,
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
    const snapshot = JSON.parse(readFileSync(opts.snapshot, 'utf8')) as ReplaySnapshotFile;
    const { valid, actual } = await verifyReplayStateHash(result, snapshot.stateHash);
    if (valid) {
      logger.info('VERIFICATION PASSED: State hash matches snapshot');
      console.log('✅ VERIFICATION PASSED');
      process.exit(0);
    } else {
      logger.error('VERIFICATION FAILED: State hash mismatch', undefined, { expected: snapshot.stateHash, actual });
      console.log('❌ VERIFICATION FAILED');
      console.log(`Expected: ${snapshot.stateHash}`);
      console.log(`Actual:   ${actual}`);
      process.exit(1);
    }
  }

  if (opts.output) {
    await serializeReplayResult(result, opts.output);
    logger.info('Snapshot written', { path: opts.output, stateHash });
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
  logger.error('Replay failed', err instanceof Error ? err : undefined, { error: errMsg(err) });
  process.exit(1);
});