import { expect, test } from '../../framework/fixtures/senars-app';
import { waitConnected } from '../../framework/utils/interactions';

test('the composer status names the active LM provider @critical', async ({ page, testApi }) => {
  await waitConnected(testApi);
  // The LM provider lives in the composer status strip (the old top-bar panel was
  // folded into `bottom-bar`); it names the provider even before a model answers.
  const composer = page.locator('bottom-bar');
  await expect(composer).toBeVisible();
  await expect(composer).toContainText('LM:');
});
