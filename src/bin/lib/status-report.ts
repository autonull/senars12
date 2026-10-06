#!/usr/bin/env tsx

/**
 * `senars status` — live System One observability (I2/X12):
 * manifold health, per-head calibration, spend counters, dataset/lock artifacts,
 * and `systemOne.enabled` provenance.
 *
 * Flags:
 *   --json   Machine-readable output (non-TTY mode)
 *   --budget Show the root budget slice (AIKR observability)
 */

import { existsSync, statSync } from 'node:fs';
import {
  ALL_RESOURCES,
  BUDGET_RESOURCES,
  type BudgetSlice,
  isExhausted,
  pressure,
  remainingAll,
} from '@senars/core/budget';
import { createLMService } from '@senars/nar';
import { NARBuilder } from '@senars/nar/agent/builder';
import {
  CALIBRATION_LOCK_PATH,
  HEAD_SPECS,
  type SystemOneManifold,
} from '@senars/nar/lm/system-one';
import { createLogger, errMsg, formatBytes, parseFlags, pct } from '@senars/util';
import { loadConfig } from '../../config/index.js';
import { renderReport } from '../commands/args.js';
import { systemOneDefaults, systemOneSchema } from '../../config/schema.js';
import { mettaPort } from './metta.js';

const logger = createLogger({ scope: 'status' });

interface StatusReport {
  systemOne: { enabled: boolean; provenance: 'config-file' | 'default' };
  manifold: { provider: string; health: Record<string, unknown> } | null;
  heads: Array<{
    headId: string;
    kind: string;
    ece: number | null;
    abstainThreshold: number | null;
  }>;
  spend: Record<string, { calls: number; tokensIn: number; tokensOut: number; costMilli: number }>;
  artifacts: {
    datasetPath: string;
    datasetExists: boolean;
    datasetBytes: number;
    lockPath: string;
    lockExists: boolean;
    lockBytes: number;
  };
  governance: { attachedGames: number; awaitingValidation: number; awaitingApproval: number };
  budget?: { slice: BudgetSlice };
}

const byteSize = (path: string): { exists: boolean; bytes: number } => {
  if (!existsSync(path)) return { exists: false, bytes: 0 };
  return { exists: true, bytes: statSync(path).size };
};

const collect = async (): Promise<StatusReport> => {
  const appConfig = await loadConfig();
  const systemOne = appConfig.systemOne ?? systemOneSchema.parse({});
  const provenance =
    appConfig.systemOne === undefined ||
    JSON.stringify(appConfig.systemOne) === JSON.stringify(systemOneDefaults)
      ? 'default'
      : 'config-file';

  const nar = (
    await new NARBuilder()
      .withLM(createLMService())
      .withMetta(mettaPort())
      .withNarConfig({ systemOne })
      .build()
  ).nar;
  const dataset = byteSize(systemOne.distillation.datasetPath);
  const lock = byteSize(CALIBRATION_LOCK_PATH);
  const report: StatusReport = {
    systemOne: { enabled: nar.isSystemOneEnabled(), provenance },
    manifold: null,
    heads: [],
    spend: {},
    artifacts: {
      datasetPath: systemOne.distillation.datasetPath,
      datasetExists: dataset.exists,
      datasetBytes: dataset.bytes,
      lockPath: CALIBRATION_LOCK_PATH,
      lockExists: lock.exists,
      lockBytes: lock.bytes,
    },
    governance: { attachedGames: 0, awaitingValidation: 0, awaitingApproval: 0 },
  };

  const manifold = nar.getSystemOneManifold();
  if (manifold && 'health' in manifold) {
    report.manifold = {
      provider: systemOne.manifold.provider,
      health: manifold.health() as unknown as Record<string, unknown>,
    };
    const sysManifold = manifold as SystemOneManifold;
    const calibrators = sysManifold.getCalibrators?.();
    const thresholds = sysManifold.getAbstainThresholds?.();
    report.heads = Object.entries(HEAD_SPECS).map(([headId, spec]) => ({
      headId,
      kind: spec.kind,
      ece: calibrators?.get(headId)?.getECE() ?? null,
      abstainThreshold: thresholds?.get(headId) ?? null,
    }));
  }

  const spend = nar.getLMClient()?.getSpend();
  if (spend) report.spend = spend as StatusReport['spend'];

  const governance = nar.getSelfMetaGame().getGovernanceQueues();
  report.governance = {
    attachedGames: nar.getAttachedGames().length,
    awaitingValidation: governance.validation,
    awaitingApproval: governance.approval,
  };

  // Optional capability: absent unless a root budget slice is exposed on the NAR.
  if (parseFlags().has('--budget')) {
    const rootSlice = (nar as { getRootBudgetSlice?: () => BudgetSlice }).getRootBudgetSlice?.();
    if (rootSlice) report.budget = { slice: rootSlice };
  }

  await nar.dispose?.();
  return report;
};

/**
 * The four AIKR dimensions, each with the ceiling key that bounds it.
 *
 * Read off `BUDGET_RESOURCES` rather than written out: this was a fourth
 * hand-written copy of the dimension table, so a dimension renamed in
 * `core/budget` would have printed as `undefined` here rather than failing.
 */
const DIMENSIONS = ALL_RESOURCES.map((resource) => [resource, BUDGET_RESOURCES[resource].total] as const);

/** The root slice's per-dimension spend, worst dimension, and terminal state. */
const renderBudgetSlice = (slice: BudgetSlice): string => {
  const remaining = remainingAll(slice);
  const rows = DIMENSIONS.map(
    ([consumed, total]) =>
      `  ${consumed.padEnd(11)} ${slice.consumed[consumed]}/${slice[total]}  remaining ${remaining[consumed]}`
  );
  rows.push(`  pressure    ${pct(pressure(slice))}`);
  if (slice.terminationReason) rows.push(`  TERMINATED  ${slice.terminationReason}`);
  else if (isExhausted(slice)) rows.push('  TERMINATED  all dimensions spent');
  return ['Budget slice:', ...rows].join('\n');
};

const renderText = (r: StatusReport): string => {
  const lines = [`System One: ${r.systemOne.enabled ? 'enabled' : 'disabled'} (${r.systemOne.provenance})`];
  if (r.manifold) {
    lines.push(`Manifold (${r.manifold.provider}): ${JSON.stringify(r.manifold.health)}`, 'Heads:');
    for (const h of r.heads)
      lines.push(
        `  ${h.headId.padEnd(24)} ${h.kind.padEnd(8)} ece=${h.ece?.toFixed(4) ?? '—'} abstain=${h.abstainThreshold?.toFixed(2) ?? '—'}`
      );
  } else {
    lines.push('Manifold: not constructed (System One disabled)');
  }
  const providers = Object.entries(r.spend);
  if (providers.length > 0) {
    lines.push('Spend:');
    for (const [provider, s] of providers)
      lines.push(
        `  ${provider}: ${s.calls} calls, ${s.tokensIn}/${s.tokensOut} tokens, ${s.costMilli} milli-USD`
      );
  }
  lines.push(
    `Dataset: ${r.artifacts.datasetPath} (${r.artifacts.datasetExists ? formatBytes(r.artifacts.datasetBytes) : 'absent'})`,
    `Calibration lock: ${r.artifacts.lockPath} (${r.artifacts.lockExists ? formatBytes(r.artifacts.lockBytes) : 'absent'})`,
    `Governance: ${r.governance.attachedGames} attached game(s), awaiting validation: ${r.governance.awaitingValidation}, awaiting approval: ${r.governance.awaitingApproval}`
  );
  if (r.budget) lines.push('', renderBudgetSlice(r.budget.slice));
  return lines.join('\n');
};

export const runStatus = async (): Promise<StatusReport> => {
  const report = await collect();
  console.log(renderReport(report, renderText));
  return report;
};

if (process.argv[1]?.endsWith('status-report.ts')) {
  runStatus().catch((e) => {
    logger.error('status failed', e instanceof Error ? e : undefined, { error: errMsg(e) });
    process.exit(1);
  });
}
