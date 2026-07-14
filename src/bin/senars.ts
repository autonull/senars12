#!/usr/bin/env tsx
import { Kernel } from '@senars/core';
import { NarBackend } from '@senars/nar/backend';
import { MettaBackend } from '@senars/metta/backend';
import { VisualizationBackend } from '@senars/ui/backend';
import { InMemoryEventLog } from '@senars/core/eventlog';

const log = new InMemoryEventLog();
const kernel = new Kernel(log);

await kernel.register(new NarBackend());
await kernel.register(new MettaBackend());
await kernel.register(new VisualizationBackend());

await kernel.start('./senars.config.json');

console.log('SeNARS running. Event log:', log);
console.log('UI at http://localhost:8765');

process.on('SIGINT', async () => {
  console.log('\n\nShutting down...');
  await kernel.stop();
  process.exit(0);
});