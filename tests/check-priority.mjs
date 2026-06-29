import { SeNARSFactory } from '../src/nar/factory.js';

const nar = SeNARSFactory.createDefault({
  core: { maxConcepts: 200, priorityThreshold: 0.1 },
  enableLMRules: true,
});

const p = nar.getProcessor();
process.stderr.write('lmActivationThreshold: ' + p.lmActivationThreshold + '\n');

await nar.input('(bird --> animal)', 'belief');
await nar.input('(robin --> bird)', 'belief');

const c1 = nar.getConcept({ kind: 'atom', symbol: 'bird' });
const c2 = nar.getConcept({ kind: 'atom', symbol: 'animal' });
const c3 = nar.getConcept({ kind: 'atom', symbol: 'robin' });

process.stderr.write('bird priority: ' + (c1?.priority ?? 'N/A') + '\n');
process.stderr.write('animal priority: ' + (c2?.priority ?? 'N/A') + '\n');
process.stderr.write('robin priority: ' + (c3?.priority ?? 'N/A') + '\n');

// Run inference
await nar.run(3);
const log = p.getLMRuleExecutionLog();
const skipped = log.filter((e) => e.status === 'skipped');
const fired = log.filter((e) => e.status === 'fired');
process.stderr.write(`LM: ${fired.length} fired, ${skipped.length} skipped\n`);
process.stdout.write('OK\n');
