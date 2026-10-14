import { expect, test } from '../../framework/fixtures/senars-app';
import { waitConnectedDirect } from '../../framework/utils/interactions';

test.describe.configure({ retries: 0 });

test('notebook app loads, connects, and renders the reasoning workspace @app @notebook', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/notebook/');
  await waitConnectedDirect(page);

  // Verify the app shell is present
  await expect(page.locator('s-app-shell')).toBeVisible();

  // Verify the notebook surface is mounted
  await expect(page.locator('notebook-surface')).toBeVisible({ timeout: 10000 });

  // The workspace projects the engine's seeded beliefs as blocks.
  await expect(page.locator('notebook-surface article.block').first()).toBeVisible({ timeout: 15000 });

  // Verify connection status shows connected
  await expect(page.locator('header .status')).toContainText('connected');
});

test('notebook app accepts a belief and renders its block @app @notebook', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/notebook/');
  await waitConnectedDirect(page);

  await expect(page.locator('notebook-surface')).toBeVisible({ timeout: 10000 });

  // Send a novel Narsese belief via the reasoning protocol
  await page.evaluate(() => {
    const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
    api?.send?.({ type: 'reasoning.submit', term: '<zebra --> animal>.', mode: 'belief' });
  });

  // The engine admits the belief and the workspace projects it as a claim block
  const block = page.locator('notebook-surface article.block[data-id="claim:(zebra-->animal)"]');
  await expect(block).toBeVisible({ timeout: 15000 });
  await expect(block.locator('.kind')).toContainText('Claim');
});

test('notebook app breadcrumb navigation follows focus @app @notebook', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/notebook/');
  await waitConnectedDirect(page);

  await expect(page.locator('notebook-surface')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('notebook-surface article.block').first()).toBeVisible({ timeout: 15000 });

  // Focusing a block reveals the path to it
  await page.locator('notebook-surface article.block[data-kind="claim"]').first().click();
  await expect(page.locator('.breadcrumb')).toBeVisible({ timeout: 5000 });
});
