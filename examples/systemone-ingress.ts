/**
 * System One ingress — natural language in, calibrated judgments out.
 * Run: `pnpm tsx examples/systemone-ingress.ts`
 */
import { createNAR } from '../nar/src/factory.js';

const nar = createNAR({
  systemOne: { enabled: true },
  maxConcepts: 500,
});

// The manifold emits one judgment.resolved kernel event per head per input.
// (With the default deterministic provider no events fire — set systemOne.manifold
// .provider to a real backend in your config to see the 6-head distribution.)
const eventBus = nar.getSystemEventBus();
eventBus.on('judgment.resolved', (event: { payload: Record<string, unknown> }) => {
  const p = event.payload as { queryId?: string; score?: number; abstained?: boolean };
  console.log(`judgment: ${p.queryId} → ${p.abstained ? 'abstain' : p.score}`);
});

console.log('Feeding a raw English sentence through the perception gate...');
await nar.input('the robin is a bird');

for (const belief of nar.getBeliefs()) {
  const t = (belief as { term: { toString(): string }; truth?: { f: number; c: number } }).truth;
  const term = (belief as { term: { toString(): string } }).term.toString();
  console.log(`belief: ${term} f=${t?.f.toFixed(2)} c=${t?.c.toFixed(2)}`);
}

await nar.dispose();
