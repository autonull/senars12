/**
 * `senars experiment notebook` — Export experiment to Jupyter notebook.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'experiment:notebook' });

export const sections: HelpSection[] = [
  standardSections.usage('senars experiment notebook', 'Export experiment to Jupyter notebook'),
  {
    title: 'Arguments',
    lines: [
      '<run-id>               Experiment run ID to export',
    ],
  },
  {
    title: 'Options',
    lines: [
      '--output <path>        Output .ipynb file path (default: experiment.ipynb)',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars experiment notebook abc123',
    'senars experiment notebook abc123 --output my-experiment.ipynb',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const runId = argv.positional[0];
  const outputPath = argv.str('--output', 'experiment.ipynb');

  if (!runId) {
    console.error('Error: <run-id> argument required');
    process.exit(1);
  }

  // This is a stub - experiment persistence would need to be implemented
  const notebook = {
    nbformat: 4,
    nbformat_minor: 4,
    metadata: {
      kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' },
      language_info: { name: 'python', version: '3.10.0' },
    },
    cells: [
      {
        cell_type: 'markdown',
        metadata: {},
        source: [`# Experiment: ${runId}`, '', 'Auto-generated from SeNARS experiment run.'],
      },
      {
        cell_type: 'code',
        metadata: {},
        source: ['import json', 'import matplotlib.pyplot as plt', 'import numpy as np', ''],
        outputs: [],
        execution_count: null,
      },
      {
        cell_type: 'code',
        metadata: {},
        source: [`# Load experiment data`, `with open('${runId}.json') as f:`, `    data = json.load(f)`, 'print(data)'],
        outputs: [],
        execution_count: null,
      },
    ],
  };

  const { writeFileSync } = await import('node:fs');
  writeFileSync(outputPath, JSON.stringify(notebook, null, 2));

  if (jsonOutput) {
    console.log(JSON.stringify({ runId, outputPath, success: true }, null, 2));
  } else {
    console.log(`Notebook exported to ${outputPath}`);
  }
}

export const experimentNotebookModule: CommandModule = {
  main,
  sections,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}