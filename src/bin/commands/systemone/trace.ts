/** Trace grader: .trace on|off|status|sample <0-1>|dataset */

import { cmd } from '@senars/cli';
import { dispatchSub, onOff, ratioArg } from '../args';
import { incrementCount } from '@senars/util/collections';
import { systemOneOf } from '../context';
import type { BotRuntime } from '../context';

export const traceCommand = cmd(
  'trace',
  'Trace grader: .trace on|off|status|sample <0-1>|dataset',
  (rt: BotRuntime) => (args = '') => {
    const { trace } = rt;
    const usage = 'Usage: .trace on|off|status|sample <0-1>|dataset';
    return dispatchSub(
      args,
      {
        ...onOff(
          () => trace.enabled,
          (v) => { trace.enabled = v; },
          (on) => `Trace grader: ${on ? 'on' : 'off'} sampleRate=${trace.sampleRate} grader=${trace.grader ? 'available' : 'unavailable'}`,
          'Trace grader'
        ),
        sample: ([raw]) => {
          if (!raw) return 'Usage: .trace sample <0-1>';
          const parsed = ratioArg(raw, 'Sample rate');
          if ('error' in parsed) return parsed.error;
          trace.sampleRate = parsed.value;
          return `Trace sample rate set to ${parsed.value}`;
        },
        dataset: () => {
          const dataset = systemOneOf(rt)?.dataset;
          if (!dataset) return 'Dataset not available (distillation not configured)';
          const bySource = new Map<string, number>();
          for (const row of dataset.all()) incrementCount(bySource, row.source, 1);
          return `Dataset: ${dataset.size} labels\n${[...bySource].map(([s, n]) => `  ${s}: ${n}`).join('\n')}`;
        },
      },
      { defaults: ['status'], usage }
    );
  }
);