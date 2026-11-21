#!/usr/bin/env tsx
/**
 * Generate the capability manifest and run the preservation gate.
 */

import { buildCapabilityManifest, writeManifest, runPreservationGate, preservationGateCLI } from './capability-manifest-core.js';
import { parseFlags } from '@senars/util/cli';

async function main() {
  const flags = parseFlags();
  const update = flags.has('--update') || flags.has('--gate');

  if (flags.has('--gate')) {
    await preservationGateCLI();
    return;
  }

  const manifest = await buildCapabilityManifest();
  await writeManifest(manifest);
  console.log(`Capability manifest generated: ${manifest.capabilities.length} capabilities`);

  if (update) {
    const result = await runPreservationGate(manifest);
    console.log('Preservation Gate:', result.pass ? 'PASS' : 'FAIL');
    if (!result.pass) {
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});