import {termParser} from '../src/nar/terms/index.js';

const tests = [
  'bird',
  '"can fly"',
  '<bird --> "can fly">',
  '<Tweety --> bird>.',
  '<bird --> "can fly">. :1.0:0.9',
  'All birds can fly',
  'Tweety is a bird',
];

console.log('Testing termParser.parse():');
for (const test of tests) {
  try {
    const result = termParser.parse(test);
    console.log(`✓ "${test}" → OK`);
  } catch (e: any) {
    console.log(`✗ "${test}" → ${e.message}`);
  }
}
