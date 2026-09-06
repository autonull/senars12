import { afterEach, describe, expect, test } from 'vitest';
import { SeNARSFactory, type NAR } from '../../../nar/src';

const created: NAR[] = [];

async function makeNar(options: Parameters<typeof SeNARSFactory.createDefault>[0] = {}): Promise<NAR> {
  const nar = SeNARSFactory.createDefault({ enableLMRules: false, ...options });
  created.push(nar);
  await nar.start();
  return nar;
}

afterEach(async () => {
  while (created.length) await created.pop()?.stop();
});

describe('SeNARSFactory.createDefault', () => {
  test('default does not enable optional subsystems', async () => {
    const nar = await makeNar();
    expect(nar.getSelfAnalyzer()).toBeUndefined();
    expect(nar.getRLFP()).toBeUndefined();
    expect(nar.listTools().some((t) => t.name === 'switch_strategy')).toBe(false);
  });

  test('forwards enableSelf/enableTools/enableRLFP feature flags', async () => {
    const nar = await makeNar({ enableSelf: true, enableTools: true, enableRLFP: true });

    expect(nar.getSelfAnalyzer()).toBeDefined();
    expect(nar.getRLFP()).toBeDefined();

    const toolNames = nar.listTools().map((t) => t.name);
    expect(toolNames).toContain('switch_strategy');
    expect(toolNames).toContain('apply_fix');
    expect(toolNames).toContain('tune_knob');
    expect(toolNames).toContain('run_scenario_shadow');
  });

  test('forwards maxConcepts override', async () => {
    const nar = await makeNar({ maxConcepts: 50 });
    expect(nar.getConfig().maxConcepts).toBe(50);
  });
});