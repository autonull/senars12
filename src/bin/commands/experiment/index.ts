/**
 * `senars experiment` — Experiment commands (run, list, show, compare, analyze, sweep, notebook).
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { experimentRunModule } from './run';
import { experimentListModule } from './list';
import { experimentShowModule } from './show';
import { experimentCompareModule } from './compare';
import { experimentAnalyzeModule } from './analyze';
import { experimentSweepModule } from './sweep';
import { experimentNotebookModule } from './notebook';

// Register experiment subcommands
registerCommand('experiment run', experimentRunModule);
registerCommand('experiment list', experimentListModule);
registerCommand('experiment show', experimentShowModule);
registerCommand('experiment compare', experimentCompareModule);
registerCommand('experiment analyze', experimentAnalyzeModule);
registerCommand('experiment sweep', experimentSweepModule);
registerCommand('experiment notebook', experimentNotebookModule);

export const experimentModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars experiment <run|list|show|compare|analyze|sweep|notebook>');
    process.exit(1);
  },
  sections: [
    {
      title: 'Usage',
      lines: ['senars experiment <run|list|show|compare|analyze|sweep|notebook> [options]'],
    },
    {
      title: 'Subcommands',
      lines: [
        '  run        Run an experiment',
        '  list       List experiments',
        '  show       Show experiment details',
        '  compare    Compare experiment runs',
        '  analyze    Analyze experiment results',
        '  sweep      Parameter sweep experiment',
        '  notebook   Export experiment to Jupyter notebook',
      ],
    },
  ],
  subcommands: new Map([
    ['run', experimentRunModule],
    ['list', experimentListModule],
    ['show', experimentShowModule],
    ['compare', experimentCompareModule],
    ['analyze', experimentAnalyzeModule],
    ['sweep', experimentSweepModule],
    ['notebook', experimentNotebookModule],
  ]),
};