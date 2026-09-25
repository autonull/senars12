#!/usr/bin/env tsx
/**
 * `senars status` — live System One observability (I2/X12):
 * manifold health, per-head calibration, spend counters, dataset/lock artifacts,
 * and `systemOne.enabled` provenance.
 *
 * Flags:
 *   --json   Machine-readable output (non-TTY mode)
 */

import { existsSync, statSync } from 'node:fs';
import { loadConfig } from '../../config/index.js';
import { createLMService } from '@senars/nar';
import { NARBuilder } from '@senars/nar/agent/builder';
import { HEAD_SPECS } from '@senars/nar/lm/system-one/head-specs.js';
import { SystemOneManifold } from '@senars/nar/lm/system-one/manifold.js';
import { systemOneDefaults, systemOneSchema } from '../../config/schema.js';
import { createLogger } from '@senars/nar/logger';

const logger = createLogger({ scope: 'status' });

interface StatusReport {
  systemOne: { enabled: boolean; provenance: 'config-file' | 'default' };
  manifold: { provider: string; health: Record<string, unknown> } | null;
  heads: Array<{ headId: string; kind: string; ece: number | null; abstainThreshold: number | null }>;
  spend: Record<string, { calls: number; tokensIn: number; tokensOut: number; costMilli: number }>;
  artifacts: { datasetPath: string; datasetExists: boolean; datasetBytes: number; lockPath: string; lockExists: boolean; lockBytes: number };
  governance: { attachedGames: number; awaitingValidation: number; awaitingApproval: number };
}

const byteSize = (path: string): { exists: boolean; bytes: number } => {
  if (!existsSync(path)) return { exists: false, bytes: 0 };
  return { exists: true, bytes: statSync(path).size };
};

const LOCK_PATH = '.cache/systemone/calibration-lock.json';

const collect = async (): Promise<StatusReport> => {
  const appConfig = await loadConfig();
  const systemOne = appConfig.systemOne ?? systemOneSchema.parse({});
  const provenance =
    appConfig.systemOne === undefined ||
    JSON.stringify(appConfig.systemOne) === JSON.stringify(systemOneDefaults)
      ? 'default'
      : 'config-file';

  const nar = (await new NARBuilder().withLM(createLMService()).withNarConfig({ systemOne }).build()).nar;
  const dataset = byteSize(systemOne.distillation.datasetPath);
  const lock = byteSize(LOCK_PATH);
  const report: StatusReport = {
    systemOne: { enabled: nar.isSystemOneEnabled(), provenance },
    manifold: null,
    heads: [],
    spend: {},
    artifacts: {
      datasetPath: systemOne.distillation.datasetPath,
      datasetExists: dataset.exists,
      datasetBytes: dataset.bytes,
      lockPath: LOCK_PATH,
      lockExists: lock.exists,
      lockBytes: lock.bytes,
    },
    governance: { attachedGames: 0, awaitingValidation: 0, awaitingApproval: 0 },
  };

  const manifold = nar.getSystemOneManifold();
  if (manifold && 'health' in manifold) {
    report.manifold = { provider: systemOne.manifold.provider, health: manifold.health() as unknown as Record<string, unknown> };
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

  await nar.dispose?.();
  return report;
};

const renderText = (r: StatusReport): void => {
  console.log(`System One: ${r.systemOne.enabled ? 'enabled' : 'disabled'} (${r.systemOne.provenance})`);
  if (r.manifold) {
    console.log(`Manifold (${r.manifold.provider}):`, JSON.stringify(r.manifold.health));
    console.log('Heads:');
    for (const h of r.heads)
      console.log(
        `  ${h.headId.padEnd(24)} ${h.kind.padEnd(8)} ece=${h.ece?.toFixed(4) ?? '—'} abstain=${h.abstainThreshold?.toFixed(2) ?? '—'}`
      );
  } else {
    console.log('Manifold: not constructed (System One disabled)');
  }
  const providers = Object.entries(r.spend);
  if (providers.length > 0) {
    console.log('Spend:');
    for (const [provider, s] of providers)
      console.log(`  ${provider}: ${s.calls} calls, ${s.tokensIn}/${s.tokensOut} tokens, ${s.costMilli} milli-USD`);
  }
  console.log(
    `Dataset: ${r.artifacts.datasetPath} (${r.artifacts.datasetExists ? `${r.artifacts.datasetBytes} B` : 'absent'})`
  );
  console.log(
    `Calibration lock: ${r.artifacts.lockPath} (${r.artifacts.lockExists ? `${r.artifacts.lockBytes} B` : 'absent'})`
  );
  console.log(
    `Governance: ${r.governance.attachedGames} attached game(s), awaiting validation: ${r.governance.awaitingValidation}, awaiting approval: ${r.governance.awaitingApproval}`
  );
};

export const runStatus = async (): Promise<StatusReport> => {
  const report = await collect();
  if (process.argv.includes('--json') || !process.stdout.isTTY) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    renderText(report);
  }
  return report;
};

if (process.argv[1]?.endsWith('status-report.ts')) {
  runStatus().catch((e) => {
    logger.error('status failed', e instanceof Error ? e : undefined, { error: e instanceof Error ? e.message : String(e) });
    process.exit(1);
  });
}
