import { test, expect } from '../../framework/fixtures/senars-app';

test('UI handles rapid config changes without crashing', async ({ config }) => {
  await config.open();

  for (let i = 0; i < 50; i++) {
    await config.setSlider('llm.temperature', 0.1 + (i % 19) * 0.1);
  }

  await expect(async () => {
    const val = await config.getFieldValue('llm.temperature');
    expect(val).toBeTruthy();
  }).toPass({ timeout: 2000 });
});
