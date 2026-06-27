import { test, expect } from '../../framework/fixtures/senars-app';

test('user can adjust slider parameters and values are reflected in UI', async ({ config, ws }) => {
  await ws.injectConfigSchema({
    'llm.temperature': {
      type: 'slider',
      label: 'LLM Temperature',
      value: 0.7,
      min: 0,
      max: 2,
      step: 0.1,
    },
  });

  await config.open();
  await config.assertFieldExists('llm.temperature');
  await config.setSlider('llm.temperature', 1.5);

  await expect(async () => {
    const val = await config.getFieldValue('llm.temperature');
    expect(val).toBe('1.5');
  }).toPass({ timeout: 2000 });
});
