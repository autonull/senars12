import {SeNARSFactory} from '../src/nar/factory.js';
import {createSeNARSRegistry} from '../src/nar/lm/providers.js';
import {createInterface} from 'node:readline';

process.stderr.write('NAR init...\n');
const registry = createSeNARSRegistry();
const nar = SeNARSFactory.createDefault({
  providerRegistry: registry,
  core: {maxConcepts: 200, priorityThreshold: 0.1},
  enableLMRules: true,
});
await nar.initialize();
process.stderr.write('NAR ready\n');

const lmClient = nar.getLMClient?.();
if (lmClient?.init) {
  process.stderr.write('LM init...\n');
  try {
    await lmClient.init();
    process.stderr.write('LM ready, available=' + lmClient.available + '\n');
  } catch(e) {
    process.stderr.write('LM error: ' + e.message + '\n');
  }
}

process.stderr.write('Reading stdin...\n');
const rl = createInterface({input: process.stdin});
let count = 0;
for await (const line of rl) {
  count++;
  process.stderr.write('LINE[' + count + ']: ' + line + '\n');
  console.log('RESULT: processed=' + count + ' input=' + line);
}
process.stderr.write('EOF after ' + count + ' lines\n');
