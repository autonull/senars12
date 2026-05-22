import {termParser} from '../src/nar/terms/index.js';

const tests = [
  'All birds can fly',
  'Tweety is a bird',
  '(bird --> can-fly)',
  '<bird --> can-fly>.',
  '<bird --> can-fly>. :1.0:0.9',
  'bird',
  'Birds',
];

for (const test of tests) {
  try {
    termParser.parse(test);
    console.log(`✓ parse() "${test}" → Term OK`);
  } catch (e: any) {
    console.log(`✗ parse() "${test}" → ${e.message}`);
  }
}
console.log('---');
for (const test of tests) {
  try {
    termParser.parseWithTruth(test);
    console.log(`✓ parseWithTruth() "${test}" → Task OK`);
  } catch (e: any) {
    console.log(`✗ parseWithTruth() "${test}" → ${e.message}`);
  }
}
