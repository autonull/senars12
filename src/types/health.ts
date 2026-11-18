/** @public Health-check result for a single subsystem probe. */
export interface HealthCheckResult {
  ok: boolean;
  detail?: string;
}

/** @public Aggregate readiness report consumed by `/health/ready` and `pnpm doctor`. */
export interface HealthReport {
  ready: boolean;
  checks: Record<string, HealthCheckResult>;
}
