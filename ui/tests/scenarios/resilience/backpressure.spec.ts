import { test, expect } from '../../framework/fixtures/senars-app';

test('UI handles rapid config changes without crashing', async ({ config, ws }) => {
  await ws.injectConfigSchema({
    'llm.temperature': { type: 'slider', label: 'Temperature', value: 0.7, min: 0, max: 2, step: 0.1 },
    'nars.revision_rate': { type: 'slider', label: 'Revision Rate', value: 0.5, min: 0, max: 1, step: 0.1 },
  });

  await config.open();

  for (let i = 0; i < 50; i++) {
    await config.setSlider('llm.temperature', 0.1 + (i % 19) * 0.1);
  }

  await expect(async () => {
    const val = await config.getFieldValue('llm.temperature');
    expect(val).toBeTruthy();
  }).toPass({ timeout: 2000 });
});
