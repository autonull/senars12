/**
 * Shared doctor checks used by both `bot --doctor` (doctor-report.ts) and
 * the `.doctor` command in diagnostics.ts.
 */

import { loadConfig } from '../../config/index';
import { envSet, errMsg } from '@senars/util';
import { attempted } from '@senars/cli';
import { probeEmbeddedLlama } from '../../lm/index';

/** Every credential any provider may need. One list, so a key cannot be checked in
 *  one entry point and ignored in the other. */
const CREDENTIAL_KEYS = [
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
  return attempted('probe', async () => {
    const probe = await probeEmbeddedLlama();
    return `${probe.available ? 'ok' : 'FAIL'}: ${probe.detail}`;
  });
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