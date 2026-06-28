import { test, expect } from '../../framework/fixtures/senars-app';

test('UI handles rapid config changes without crashing', async ({ config }) => {
  await config.open();

  for (let i = 0; i < 50; i++) {
    const value = Math.round((0.1 + (i % 19) * 0.1) * 10) / 10;
    await config.setSlider('llm.temperature', value);
  }

  await expect(async () => {
    const val = await config.getFieldValue('llm.temperature');
    expect(val).toBeTruthy();
  }).toPass({ timeout: 2000 });
});
