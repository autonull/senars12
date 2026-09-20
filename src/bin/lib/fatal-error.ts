/**
 * I5/X14: shared entrypoint error UX — remediation for known error classes,
 * never a bare stack trace for actionable failures.
 */
import { ConfigurationError } from '@senars/util/errors';

interface Remediation {
  match: (err: unknown) => boolean;
  hint: (err: unknown) => string;
}

const REMEDIATIONS: Remediation[] = [
  {
    match: (err) => err instanceof Error && err.name === 'LMUnavailableError',
    hint: (err) =>
      `${(err as Error).message}\n  Check provider availability, or run 'pnpm doctor' for a connectivity probe.\n  Offline fallback: set LM_PROVIDER=mock (no LM calls) or LM_OFFLINE=1 (skip all probes).`,
  },
  {
    match: (err) => err instanceof ConfigurationError,
    hint: (err) =>
      `${(err as Error).message}\n  Validate your config: 'pnpm config:validate'. Effective settings: 'pnpm status'.`,
  },
];

/** Run a bin entrypoint with remediation-aware fatal error handling. */
export const runEntrypoint = (main: () => Promise<void>): void => {
  main().catch((err: unknown) => {
    const remediation = REMEDIATIONS.find((r) => r.match(err));
    if (remediation) {
      console.error(`\n${remediation.hint(err)}\n`);
    } else {
      console.error(err);
    }
    process.exit(1);
  });
};
