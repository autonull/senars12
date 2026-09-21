#!/usr/bin/env tsx
/**
 * Narsese Fuzzing Harness
 *
 * Generates random Narsese strings and feeds them to the parser + kernel.
 * Run with: pnpm fuzz
 * Or: pnpm exec tsx scripts/fuzz-narsese.ts [iterations] [--seed N]
 */

import { createNAR } from '../nar/src/nar-presets.js';
import { termParser } from '../nar/src/terms/parser-peggy.js';
import { Truth } from '../nar/src/terms/truth.js';
import type { Term } from '../nar/src/terms/types.js';

const ATOMS = [
  'cat', 'dog', 'animal', 'mammal', 'bird', 'fish',
  'red', 'blue', 'green', 'big', 'small', 'fast', 'slow',
  'eat', 'sleep', 'run', 'fly', 'swim', 'walk',
  'john', 'mary', 'bob', 'alice', 'tom', 'jerry',
  'apple', 'banana', 'car', 'house', 'tree', 'water',
  '?x', '?y', '?z', '$var', '$value', '$item',
  'TRUE', 'FALSE',
];

const OPERATORS = [
  '-->', '<->', '==>', '<=>',
  '&', '|',
  '*', '|',
  '-',
];

const PUNCTUATION = ['.', '?', '!', ';'];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomAtom(): string {
  if (Math.random() < 0.3) {
    return randomElement(ATOMS);
  }
  const len = randomInt(1, 10);
  let result = '';
  for (let i = 0; i < len; i++) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';
    result += chars[randomInt(0, chars.length - 1)];
  }
  return result;
}

function generateRandomTerm(depth: number = 0): string {
  if (depth > 3 || Math.random() < 0.3) {
    return generateRandomAtom();
  }

  const op = randomElement(OPERATORS);
  const left = generateRandomTerm(depth + 1);
  const right = generateRandomTerm(depth + 1);

  if (op === '-') {
    return `(- ${right})`;
  }
  if (op === '&' || op === '|') {
    const count = randomInt(2, 4);
    const terms = [left, right];
    for (let i = 2; i < count; i++) {
      terms.push(generateRandomTerm(depth + 1));
    }
    return `(${terms.join(` ${op} `)})`;
  }
  return `(${left} ${op} ${right})`;
}

function generateRandomTruth(): string {
  const f = Math.random().toFixed(4);
  const c = Math.random().toFixed(4);
  return `%${f};${c}%`;
}

function generateRandomNarsese(): string {
  const term = generateRandomTerm();
  const hasTruth = Math.random() < 0.4;
  const truth = hasTruth ? ` ${generateRandomTruth()}` : '';
  const punc = randomElement(PUNCTUATION);
  return `${term}${truth}${punc}`;
}

function mutateString(input: string): string {
  const mutations = [
    () => input + randomElement(PUNCTUATION),
    () => input.slice(0, -1) + randomElement(PUNCTUATION),
    () => input + ' ' + generateRandomAtom(),
    () => input.replace(/[a-z]/gi, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))),
    () => {
      const pos = Math.floor(Math.random() * input.length);
      return input.slice(0, pos) + randomElement(['(', ')', '&', '|', '-', '*', '-->', '<->', '==>', '<=>']) + input.slice(pos);
    },
    () => {
      if (input.length < 2) return input;
      const pos = Math.floor(Math.random() * (input.length - 1));
      return input.slice(0, pos) + input.slice(pos + 1);
    },
    () => {
      const pos = Math.floor(Math.random() * (input.length + 1));
      return input.slice(0, pos) + generateRandomAtom() + input.slice(pos);
    },
    () => input + ' %' + Math.random().toFixed(4) + ';' + Math.random().toFixed(4) + '%',
  ];
  return randomElement(mutations)();
}

async function runFuzz(iterations: number, seed?: number): Promise<void> {
  if (seed !== undefined) {
    Math.seed = seed;
  } else {
    Math.seed = Date.now();
  }

  console.log(`Starting fuzzing with ${iterations} iterations (seed: ${Math.seed})`);

  const nar = createNAR({
    maxConcepts: 1000,
    maxTasksPerConcept: 100,
    enableLMRules: false,
    enableTools: false,
    enableSelf: false,
    enableRLFP: false,
    persistState: false,
  });

  await nar.start();

  let parseSuccess = 0;
  let parseFail = 0;
  let admitSuccess = 0;
  let admitFail = 0;
  let kernelCrashes = 0;
  const errors: Map<string, number> = new Map();

  const corpus: string[] = [];

  for (let i = 0; i < iterations; i++) {
    let input: string;
    if (corpus.length > 0 && Math.random() < 0.3) {
      input = mutateString(randomElement(corpus));
    } else {
      input = generateRandomNarsese();
    }

    corpus.push(input);
    if (corpus.length > 1000) corpus.shift();

    try {
      const parsed = termParser.parseTask(input);
      if (parsed) {
        parseSuccess++;
        corpus.push(input);

        try {
          if (parsed.taskType === 'belief') {
            await nar.believe(input);
          } else if (parsed.taskType === 'goal') {
            await nar.goal(input);
          } else if (parsed.taskType === 'question') {
            await nar.question(input);
          }
          admitSuccess++;
        } catch (e) {
          admitFail++;
          const errMsg = e instanceof Error ? e.message : String(e);
          errors.set(errMsg, (errors.get(errMsg) || 0) + 1);
        }
      } else {
        parseFail++;
      }
    } catch (e) {
      parseFail++;
      const errMsg = e instanceof Error ? e.message : String(e);
      errors.set(errMsg, (errors.get(errMsg) || 0) + 1);
    }

    if (i % 1000 === 0 && i > 0) {
      console.log(`Progress: ${i}/${iterations} - Parse: ${parseSuccess}/${parseFail} - Admit: ${admitSuccess}/${admitFail}`);
    }
  }

  await nar.stop();

  console.log('\n=== Fuzzing Results ===');
  console.log(`Iterations: ${iterations}`);
  console.log(`Parse Success: ${parseSuccess}`);
  console.log(`Parse Fail: ${parseFail}`);
  console.log(`Admit Success: ${admitSuccess}`);
  console.log(`Admit Fail: ${admitFail}`);
  console.log(`Kernel Crashes: ${kernelCrashes}`);
  console.log(`Corpus Size: ${corpus.length}`);

  if (errors.size > 0) {
    console.log('\nTop Errors:');
    const sorted = Array.from(errors.entries()).sort((a, b) => b[1] - a[1]);
    for (const [err, count] of sorted.slice(0, 10)) {
      console.log(`  ${count}x: ${err}`);
    }
  }

  if (kernelCrashes > 0) {
    console.error('\n❌ KERNEL CRASHES DETECTED!');
    process.exit(1);
  }

  console.log('\n✅ Fuzzing completed without kernel crashes');
}

const args = process.argv.slice(2);
const iterations = parseInt(args[0] || '10000', 10);
const seedArg = args.find(a => a.startsWith('--seed='));
const seed = seedArg ? parseInt(seedArg.split('=')[1], 10) : undefined;

runFuzz(iterations, seed).catch((e) => {
  console.error('Fuzzing failed:', e);
  process.exit(1);
});

// Add seed support to Math.random for reproducibility
declare global {
  interface Math {
    seed: number;
  }
}
Math.seed = Date.now();
const originalRandom = Math.random;
Math.random = function() {
  Math.seed = (Math.seed * 1664525 + 1013904223) >>> 0;
  return Math.seed / 4294967296;
};