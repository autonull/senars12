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
} from '@senars/budget';
import { createLMService } from '@senars/lm';
import { NARBuilder } from '@senars/agent';
import {
  CALIBRATION_LOCK_PATH,
  HEAD_SPECS,
  type SystemOneManifold,
} from '@senars/lm/system-one';
import { createLogger } from '@senars/util/logger';
import { errMsg } from '@senars/util/error';
import { formatBytes as formatBytesUtil } from '@senars/util/format';
import { parseFlags } from '@senars/util/cli';
import { pct } from '@senars/util/format';
import { loadConfig } from '@senars/config';
import { renderReport } from '../commands/args';
import { mettaPort } from './metta';
import { createDiagnosticNAR, loadDiagnosticConfig, readPersistedState, formatBytes, fileInfo } from './diagnostics';

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
  persisted: { statePath: string; cycleCount: number; pendingTasks: number } | null;
}

const collect = async (): Promise<StatusReport> => {
  const { config, systemOneConfig, provenance, statePath } = await loadDiagnosticConfig();

  const { nar, dispose } = await createDiagnosticNAR({
    systemOne: systemOneConfig,
    withLM: true,
  });

  const report: StatusReport = {
    systemOne: { enabled: nar.isSystemOneEnabled(), provenance },
    manifold: null,
    heads: [],
    spend: {},
    artifacts: {
      datasetPath: systemOneConfig.distillation?.datasetPath ?? '',
      datasetExists: false,
      datasetBytes: 0,
      lockPath: CALIBRATION_LOCK_PATH,
      lockExists: false,
      lockBytes: 0,
    },
    governance: { attachedGames: 0, awaitingValidation: 0, awaitingApproval: 0 },
    persisted: null,
  };

  // Artifacts
  const dataset = fileInfo(systemOneConfig.distillation?.datasetPath ?? '');
  const lock = fileInfo(CALIBRATION_LOCK_PATH);
  report.artifacts = {
    datasetPath: systemOneConfig.distillation?.datasetPath ?? '',
    datasetExists: dataset.exists,
    datasetBytes: dataset.bytes,
    lockPath: CALIBRATION_LOCK_PATH,
    lockExists: lock.exists,
    lockBytes: lock.bytes,
  };

  // Persisted state
  const persisted = readPersistedState(statePath);
  if (persisted) report.persisted = { statePath, ...persisted };

  // Manifold
  const manifold = nar.getSystemOneManifold();
  if (manifold && 'health' in manifold) {
    report.manifold = {
      provider: systemOneConfig.manifold.provider,
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

  // Spend
  const spend = nar.getLMClient()?.getSpend();
  if (spend) report.spend = spend as StatusReport['spend'];

  // Governance
  const governance = nar.getSelfMetaGame().getGovernanceQueues();
  report.governance = {
    attachedGames: nar.getAttachedGames().length,
    awaitingValidation: governance.validation,
    awaitingApproval: governance.approval,
  };

  // Optional budget slice
  if (parseFlags().has('--budget')) {
    const rootSlice = (nar as { getRootBudgetSlice?: () => BudgetSlice }).getRootBudgetSlice?.();
    if (rootSlice) report.budget = { slice: rootSlice };
  }

  await dispose();
  return report;
};

const DIMENSIONS = ALL_RESOURCES.map((resource) => [resource, BUDGET_RESOURCES[resource].total] as const);

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
    `Governance: ${r.governance.attachedGames} attached game(s), awaiting validation: ${r.governance.awaitingValidation}, awaiting approval: ${r.governance.awaitingApproval}`,
    r.persisted
      ? `Persisted state: ${r.persisted.statePath} (cycle ${r.persisted.cycleCount}, ${r.persisted.pendingTasks} pending)`
      : 'Persisted state: none'
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