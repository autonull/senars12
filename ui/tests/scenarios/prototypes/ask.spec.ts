import { expect, test } from '@playwright/test';

/**
 * The Ask prototype: the thinnest honest loop — assert, ask, read the proof.
 * Proves the kernel facade is enough to build an app without the HUD's chrome.
 */
test.describe('Ask prototype @prototype', () => {
  test('asserts beliefs, derives an answer, and shows its proof', async ({ page }) => {
    await page.goto('/apps/ask/');
    // Wait for the shell chrome and the composed surface to be registered
    await page.waitForSelector('ask-surface', { timeout: 20000 });
    await expect(page.locator('app-chrome')).toContainText('Ask', { timeout: 20000 });
    await expect(page.locator('app-chrome')).toContainText('connected', { timeout: 20000 });

    const input = page.locator('ask-surface input');
    const submit = page.locator('ask-surface button[type="submit"]');

    for (const premise of ['<bird-->animal>.', '<robin-->bird>.']) {
      await input.fill(premise);
      await submit.click();
      await expect(page.locator('ask-surface .turn.agent').last()).toContainText('belief accepted');
    }

    await input.fill('<robin-->animal>?');
    await submit.click();

    const answer = page.locator('ask-surface .turn.agent').last();
    await expect(answer).toContainText('animal', { timeout: 20000 });
    await expect(answer.locator('.confidence')).toBeVisible();
    await expect(answer.locator('details.why')).toBeVisible();
    await answer.locator('details.why summary').click();
    await expect(answer.locator('details.why .step').first()).toContainText('deduction');
  });
});
