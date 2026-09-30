/**
 * The MeTTa engine, wired where `nar` can no longer reach it.
 *
 * `metta` sits above `nar` in the layering, so the engine is injected by the
 * composition root rather than imported by its consumer. This is that root's
 * one decision: a single memoized port, because the MeTTa runtime holds spaces
 * and `bootstrapStdLib` mutates a process-global op table.
 */
import type { MettaPort } from '@senars/core/metta-port';
import { createMettaPort } from '@senars/metta/agent';

let port: MettaPort | undefined;

export const mettaPort = (): MettaPort => (port ??= createMettaPort());
