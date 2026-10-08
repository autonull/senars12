/**
 * The wire half of the LM provider façade (§0.6). `lm-provider.ts` owns the
 * state contract and stays transport-free; this module owns the two outbound
 * messages the contract implies, so a switch is requested the same way from
 * every surface. Splitting them keeps the socket module (`ws-client.ts`, which
 * imports the inbound bindings) out of the façade's dependency path.
 */

import { requestLmProvider } from './lm-provider.js';
import { send } from './ws-client.js';

/** Ask the engine which provider is live. */
export const refreshLmStatus = (): void => send({ type: 'lm.status.request' });

/**
 * Switch provider. The request is recorded as pending in `$lmProvider` and
 * settled by the status frame the engine answers with, so a switch the engine
 * cannot apply shows up as stale rather than as a silent success.
 */
export const switchLmProvider = (id: string): void => {
  if (!id.trim()) return;
  requestLmProvider(id);
  send({ type: 'lm.switch', provider: id });
  refreshLmStatus();
};