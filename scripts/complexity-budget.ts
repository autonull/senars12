#!/usr/bin/env tsx
/**
 * Complexity Budget Gate — CLI entry point.
 *
 * The measurement and the verdict live in `./lib/complexity-budget.ts`; this
 * file is the process boundary: read the budget, measure, compare, print, exit.
 */

import { join } from 'node:path';
import {
  compare,
  measureCurrent,
  REGRESSION_MESSAGE,
  readBudget,
  renderTable,
} from './lib/complexity-budget.js';
import { ROOT } from './lib/root.js';

const budgetFlag = process.argv.indexOf('--budget');
const budgetPath =
  (budgetFlag >= 0 ? process.argv[budgetFlag + 1] : undefined) ??
  join(ROOT, 'complexity-budget.json');

console.log('Complexity Budget Gate — measuring current metrics...\n');

const current = await measureCurrent();

const { rows, failed } = compare(readBudget(budgetPath), current);
console.log(renderTable(rows));

if (failed) {
  console.error(REGRESSION_MESSAGE);
  process.exit(1);
}

console.log('\n✓ complexity-budget ok — all metrics within baseline');
