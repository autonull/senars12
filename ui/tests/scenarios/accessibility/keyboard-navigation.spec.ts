import { expect, test } from '../../framework/fixtures/senars-app';
import { chatMessageCount, sendMessage, waitConnected } from '../../framework/utils/interactions';

test('keyboard navigation reaches the composer and controls are named @critical', async ({
  page,
  testApi,
}) => {
  await waitConnected(testApi);

  const unnamedControls = await page.locator('graph-toolbar button').evaluateAll((buttons) =>
    buttons.filter(
      (b) => !(b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent?.trim())
    )
  );
  expect(unnamedControls).toHaveLength(0);

  const textarea = page.locator('input-hud textarea');
  await textarea.focus();
  await expect(textarea).toBeFocused();
  await textarea.press('Escape');
  await expect(textarea).not.toBeFocused();

  await sendMessage(page, 'keyboard check');
  await expect.poll(() => chatMessageCount(testApi)).toBeGreaterThan(0);
});