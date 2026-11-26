/**
 * `senars doctor status` — Quick system status overview.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { resolveLMSettings, resolveLMConfig, cloudApiKey, getRoutingLogStatus } from '@senars/lm';
import { loadConfig } from '../../../config/index';
import { createDiagnosticNAR, probeOllama, probeEmbedded, getCredentials, getRoutingMatrix, getRoutingInfo, getCircuitBreakers } from '../../lib/diagnostics';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

export const sections = createCommandModule({
  name: 'doctor status',
  description: 'Show quick system status',
  usage: 'senars doctor status [options]',
  sections: [
    { lines: ['--json               Output machine-readable JSON', '--verbose            Show detailed status'] },
  ],
  examples: [
    'senars doctor status',
    'senars doctor status --json',
    'senars doctor status --verbose',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const verbose = flags.verbose || flagHelpers.has(rawFlags, '--verbose');

    const settings = resolveLMSettings();
    const lmConfig = resolveLMConfig();

    const output: Record<string, unknown> = {
      provider: settings.provider,
      model: settings.model ?? 'default',
      lmAvailable: settings.provider !== 'mock',
      cloudCredentials: Boolean(cloudApiKey()),
    };

    // Load config validity
    try {
      const config = await loadConfig();
      output.config = { valid: true, profile: config.profile.name };
    } catch (e) {
      output.config = { valid: false, error: String(e) };
    }

    // Credentials
    output.credentials = await getCredentials();

    // Ollama
    output.ollama = await probeOllama(settings.ollamaHost);

    // Embedded llama.cpp
    output.embeddedLlama = await probeEmbedded();

    if (verbose) {
      // Routing matrix
      output.routingMatrix = await getRoutingMatrix();
      const { offlineTier, demoted } = await getRoutingInfo();
      output.offlineTier = offlineTier;
      output.demoted = demoted;

      // Circuit breakers
      output.circuitBreakers = await getCircuitBreakers();

      // Routing log
      output.routingLog = getRoutingLogStatus();

      // NAR status (lightweight)
      const { nar, dispose } = await createDiagnosticNAR({ maxConcepts: 10 });
      output.nar = {
        concepts: nar.concepts.size,
        gates: Object.keys(nar.gates).length,
      };
      await dispose();
    }

    if (jsonOutput) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log('=== SeNARS Status ===\n');
      console.log(`Provider: ${output.provider}`);
      console.log(`Model: ${output.model}`);
      console.log(`LM Available: ${(output.lmAvailable as boolean) ? 'yes' : 'no'}`);
      console.log(`Cloud Credentials: ${(output.cloudCredentials as boolean) ? 'configured' : 'missing'}`);
      console.log(`Config: ${(output.config as { valid: boolean }).valid ? 'valid' : 'INVALID'}${(output.config as { error?: string }).error ? ` (${(output.config as { error?: string }).error})` : ''}`);
      console.log(`Ollama: ${output.ollama}`);
      console.log(`Embedded llama.cpp: ${(output.embeddedLlama as { available: boolean; detail: string }).available ? 'ok' : 'unavailable'} (${(output.embeddedLlama as { available: boolean; detail: string }).detail})`);

      if (verbose) {
        console.log('\n--- Routing ---');
        for (const [task, chain] of Object.entries(output.routingMatrix as Record<string, string[]>)) {
          console.log(`  ${task}: ${chain.join(' → ')}`);
        }
        if (output.offlineTier) console.log(`Offline tier: ${output.offlineTier}`);
        if ((output.demoted as Array<{ id: string }>).length) {
          console.log(`Demoted: ${(output.demoted as Array<{ id: string; reason: string }>).map((d) => `${d.id} (${d.reason})`).join(', ')}`);
        }

        console.log('\n--- Circuit Breakers ---');
        for (const [p, v] of Object.entries(output.circuitBreakers as Record<string, { state: string; failures: number }>)) {
          console.log(`  ${p}: ${v.state} (failures=${v.failures})`);
        }

        console.log('\n--- Routing Log ---');
        console.log(`  Enabled: ${(output.routingLog as { enabled: boolean }).enabled}`);
        console.log(`  Buffer: ${(output.routingLog as { bufferSize: number }).bufferSize}`);
        console.log(`  Path: ${(output.routingLog as { logPath: string }).logPath}`);

        console.log('\n--- NAR ---');
        console.log(`  Concepts: ${(output.nar as { concepts: number }).concepts}`);
        console.log(`  Gates: ${(output.nar as { gates: number }).gates}`);
      }
    }
  }, flags, 'doctor status');
});

export const doctorStatusModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}