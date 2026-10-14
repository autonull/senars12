import { expect, test } from '../../framework/fixtures/senars-app';
import { waitConnectedDirect } from '../../framework/utils/interactions';

test.describe.configure({ retries: 0 });

test('notebook app loads, connects, and renders empty state @app @notebook', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/notebook/');
  await waitConnectedDirect(page);

  // Verify the app shell is present
  await expect(page.locator('s-app-shell')).toBeVisible();

  // Verify the notebook surface is mounted
  await expect(page.locator('notebook-surface')).toBeVisible({ timeout: 10000 });

  // Verify empty state is shown (no roots yet)
  await expect(page.locator('s-empty-state')).toBeVisible();

  // Verify connection status shows connected
  await expect(page.locator('header .status')).toContainText('connected');
});

test('notebook app accepts input and renders blocks @app @notebook', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/notebook/');
  await waitConnectedDirect(page);

  // Wait for the notebook surface to be ready
  await expect(page.locator('notebook-surface')).toBeVisible({ timeout: 10000 });

  // Send a Narsese belief via the reasoning protocol
  await page.evaluate(() => {
    const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
    api?.send?.({ type: 'reasoning.submit', term: '<robin --> bird>.', mode: 'belief' });
  });

  // Run the engine for a few cycles to process the belief and generate cognitive events
  await page.evaluate(() => {
    const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
    api?.send?.({ type: 'reasoning.run' });
  });

  // Verify a block appears in the notebook
  await expect(page.locator('notebook-surface article.block')).toBeVisible({ timeout: 15000 });

  // Verify the block has the correct kind label
  await expect(page.locator('notebook-surface .block .kind')).toContainText('BELIEF');
});

test('notebook app breadcrumb navigation works @app @notebook', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/notebook/');
  await waitConnectedDirect(page);

  await expect(page.locator('notebook-surface')).toBeVisible({ timeout: 10000 });

  // Send a belief via the reasoning protocol
  await page.evaluate(() => {
    const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
    api?.send?.({ type: 'reasoning.submit', term: '<eagle --> bird>.', mode: 'belief' });
  });

  // Run the engine for a few cycles to process the belief and generate cognitive events
  await page.evaluate(() => {
    const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
    api?.send?.({ type: 'reasoning.run' });
  });

  // Wait for block to appear
  await expect(page.locator('notebook-surface article.block')).toBeVisible({ timeout: 15000 });

  // Click on the block to focus it
  await page.locator('notebook-surface article.block').first().click();

  // Verify breadcrumb appears
  await expect(page.locator('.breadcrumb')).toBeVisible({ timeout: 5000 });
});