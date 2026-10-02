/**
 * Hello World — 30-minute SeNARS quickstart.
 * Run: `pnpm tsx examples/hello-world.ts`
 *
 * This demonstrates the minimal pipeline: natural language → PerceptionGate → NAL → answer.
 */
import { createNAR } from '../nar/src/nar-presets.js';
import { Truth, termParser } from '../nar/src/terms/index.js';

async function main() {
  // Create NAR with default settings (no LM required — symbolic path only)
  const nar = createNAR({
    maxConcepts: 1000,
    persistState: false,
  });

  await nar.start();

  console.log('=== SeNARS Hello World ===\n');

  // 1. Add beliefs (knowledge) in Narsese
  console.log('Adding beliefs...');
  await nar.believe('(robin --> bird).', Truth.create(0.9, 0.9));
  await nar.believe('(bird --> animal).', Truth.create(0.9, 0.9));
  console.log('  (robin --> bird). %0.9;0.9%');
  console.log('  (bird --> animal). %0.9;0.9%');

  // 2. Run inference cycles
  console.log('\nRunning inference cycles...');
  await nar.run(10);

  // 3. Ask a question
  console.log('\nAsking: (robin --> animal)?');
  const answer = await nar.ask('(robin --> animal)?');

  if (answer.answer) {
    console.log(`\nAnswer: ${answer.answer}`);
    console.log(`Confidence: ${answer.confidence.toFixed(2)}`);
    console.log(`Evidence: ${answer.evidence.length} supporting tasks`);
  } else {
    console.log('\nNo answer derived yet — try more cycles');
  }

  // 4. Add another belief and query again
  console.log('\n--- Adding more knowledge ---');
  await nar.believe('(tweety --> robin).', Truth.create(0.9, 0.9));
  await nar.run(10);
  const answer2 = await nar.ask('(tweety --> animal)?');
  if (answer2.answer) {
    console.log(`\nAnswer: ${answer2.answer}`);
    console.log(`Confidence: ${answer2.confidence.toFixed(2)}`);
  } else {
    console.log('\nNo answer derived yet');
  }

  await nar.stop();
  await nar.dispose();
  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});