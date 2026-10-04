/**
 * The checks both doctor entry points make, named once.
 *
 * `bot --doctor` runs the full report (`doctor-report.ts`) and the REPL's `.doctor`
 * runs a lightweight one (`commands/diagnostics.ts`). They had each grown their own
 * credential list — three keys against five, so the flag checked for a search key the
 * prompt never mentioned — and their own embedded probe and config read, which are
 * the same reads at two granularities.
 */

import { probeEmbeddedLlama } from '@senars/nar/lm';
import { envSet, errMsg } from '@senars/util';
import { loadConfig } from '../../config/index.js';

/** Every credential any provider may need. One list, so a key cannot be checked in
 *  one entry point and ignored in the other. */
export const CREDENTIAL_KEYS = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'LM_API_KEY',
  'TAVILY_API_KEY',
  'BRAVE_API_KEY',
] as const;

export interface CredentialReport {
  readonly key: string;
  readonly present: boolean;
}

export const credentialReport = (): CredentialReport[] =>
  CREDENTIAL_KEYS.map((key) => ({ key, present: envSet(key) }));

/** `KEY=set` per credential, for the one-line form. */
export const credentialSummary = (): string =>
  credentialReport()
    .map(({ key, present }) => `${key}=${present ? 'set' : 'unset'}`)
    .join(' ');

/** The embedded llama probe as a status line; `n/a` when it is not the provider. */
export const embeddedProbe = async (provider: string): Promise<string> => {
  if (provider !== 'llamacpp-embedded') return 'n/a';
  try {
    const probe = await probeEmbeddedLlama();
    return `${probe.available ? 'ok' : 'FAIL'}: ${probe.detail}`;
  } catch (e) {
    return `probe failed: ${errMsg(e)}`;
  }
};

/** Whether the app config loads, as one boolean plus the reason when it does not. */
export const configValidity = async (): Promise<{ valid: boolean; error?: string }> => {
  try {
    await loadConfig();
    return { valid: true };
  } catch (e) {
    return { valid: false, error: errMsg(e) };
  }
};