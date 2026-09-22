import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HealthCheckResult, HealthReport } from '@senars/util';
import type { SchemaStore } from '../focus/schema-store.js';
import type { GateRegistry } from '../kernel/GateRegistry.js';

/**
 * O3 (TODO20): shared readiness checks. Consumed by the HTTP `/health/ready`
 * endpoint and available to `pnpm doctor` when a wired NAR is present.
 */
export interface HealthCheckDeps {
  lmReachable?: () => Promise<boolean>;
  schemaStore?: SchemaStore;
  gates?: Pick<GateRegistry, 'isInitialized'>;
  eventLog?: { append(event: unknown): Promise<unknown> | unknown };
}

export type { HealthCheckResult, HealthReport };

export async function runHealthChecks(deps: HealthCheckDeps = {}): Promise<HealthReport> {
  const [lm, schemaStore, gates, eventLog] = await Promise.all([
    checkLM(deps),
    checkSchemaStore(deps),
    checkGates(deps),
    checkEventLog(deps),
  ]);
  const checks = { lm, schemaStore, gates, eventLog };
  const required = Object.values(checks);
  return { ready: required.every((c) => c.ok), checks };
}

const checkLM = async ({ lmReachable }: HealthCheckDeps): Promise<HealthCheckResult> =>
  !lmReachable
    ? { ok: true, detail: 'no lm probe configured' }
    : lmReachable().then(
        (ok) => ({ ok, detail: ok ? 'provider reachable' : 'provider unreachable' }),
        (e: unknown) => ({ ok: false, detail: (e as Error).message })
      );

const checkSchemaStore = ({ schemaStore }: HealthCheckDeps): Promise<HealthCheckResult> => {
  if (!schemaStore) return Promise.resolve({ ok: true, detail: 'no schema store' });
  try {
    const dir = mkdtempSync(join(tmpdir(), 'senars-health-'));
    try {
      schemaStore.save(join(dir, 'probe.json'));
      return Promise.resolve({ ok: true, detail: `${schemaStore.size()} schemas` });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  } catch (e) {
    return Promise.resolve({ ok: false, detail: (e as Error).message });
  }
};

const checkGates = ({ gates }: HealthCheckDeps): Promise<HealthCheckResult> =>
  Promise.resolve(
    !gates
      ? { ok: true, detail: 'no gate registry' }
      : { ok: gates.isInitialized(), detail: gates.isInitialized() ? 'responsive' : 'not initialized' }
  );

const checkEventLog = ({ eventLog }: HealthCheckDeps): Promise<HealthCheckResult> => {
  if (!eventLog) return Promise.resolve({ ok: true, detail: 'no event log' });
  try {
    return Promise.resolve(eventLog.append({ type: 'health.probe', timestamp: Date.now() })).then(
      () => ({ ok: true, detail: 'appendable' }),
      (e: unknown) => ({ ok: false, detail: (e as Error).message })
    );
  } catch (e) {
    return Promise.resolve({ ok: false, detail: (e as Error).message });
  }
};
