import { expect, test } from '@playwright/test';

/**
 * The Ask prototype: the thinnest honest loop — assert, ask, read the proof.
 * Proves the kernel facade is enough to build an app without the HUD's chrome.
 */
test.describe('Ask prototype @prototype', () => {
  test('asserts beliefs, derives an answer, and shows its proof', async ({ page }) => {
    await page.goto('/apps/ask/');
    await expect(page.locator('ask-app .status')).toContainText('connected', { timeout: 20000 });

    const input = page.locator('ask-app input');
    const submit = page.locator('ask-app button[type="submit"]');

    for (const premise of ['<bird-->animal>.', '<robin-->bird>.']) {
      await input.fill(premise);
      await submit.click();
      await expect(page.locator('ask-app .turn.agent').last()).toContainText('belief accepted');
    }

    await input.fill('<robin-->animal>?');
    await submit.click();

    const answer = page.locator('ask-app .turn.agent').last();
    await expect(answer).toContainText('animal', { timeout: 20000 });
    await expect(answer.locator('.confidence')).toBeVisible();
    await expect(answer.locator('details.why')).toBeVisible();
    await answer.locator('details.why summary').click();
    await expect(answer.locator('details.why .step').first()).toContainText('deduction');
  });
});
