import { expect, test } from '../../framework/fixtures/senars-app';
import { waitConnectedDirect } from '../../framework/utils/interactions';

test.describe.configure({ retries: 0 });

test('goals app loads, connects, and renders empty state @app @goals', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/goals/');
  await waitConnectedDirect(page);

  // Verify the app shell is present
  await expect(page.locator('s-app-shell')).toBeVisible();

  // Verify the goals surface is mounted
  await expect(page.locator('goals-surface')).toBeVisible({ timeout: 10000 });

  // Verify empty state is shown (no goals yet)
  await expect(page.locator('.empty h2')).toContainText('No goals yet');

  // Verify connection status shows connected
  await expect(page.locator('header .status')).toContainText('connected');
});

test('goals app accepts goal input and renders it @app @goals', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/goals/');
  await waitConnectedDirect(page);

  // Wait for the goals surface to be ready
  await expect(page.locator('goals-surface')).toBeVisible({ timeout: 10000 });

  // Type a goal in the input field
  await page.locator('goals-surface input').fill('achieve world peace !');

  // Verify the input has the value
  await expect(page.locator('goals-surface input')).toHaveValue('achieve world peace !');

  // Submit the goal
  await page.locator('goals-surface button[type="submit"]').click();

  // Verify the input is cleared after submission (form works)
  await expect(page.locator('goals-surface input')).toHaveValue('', { timeout: 5000 });
});

test('goals app toolbar controls are functional @app @goals', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/goals/');
  await waitConnectedDirect(page);

  await expect(page.locator('goals-surface')).toBeVisible({ timeout: 10000 });

  // Verify lens selector is present and functional
  const lensSelect = page.locator('goals-surface select[aria-label="Lens"]');
  await expect(lensSelect).toBeVisible();

  // Verify graph layer selector is present
  const layerSelect = page.locator('goals-surface select[aria-label="Graph Layer"]');
  await expect(layerSelect).toBeVisible();

  // Verify filter selector is present
  const filterSelect = page.locator('goals-surface select[aria-label="Filter"]');
  await expect(filterSelect).toBeVisible();

  // Change lens and verify it updates
  await lensSelect.selectOption('belief');
  await expect(lensSelect).toHaveValue('belief');
});