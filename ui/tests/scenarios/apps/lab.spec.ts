import { expect, test } from '../../framework/fixtures/senars-app';
import { waitConnectedDirect } from '../../framework/utils/interactions';

test.describe.configure({ retries: 0 });

/**
 * The UI Lab is one page: a preset (`?v=`) or a point in the composer space
 * (`?compose=1&...`). Both must mount the composed surfaces into the grid — that
 * is the whole contract of the exploration surface.
 */
test('lab preset mounts its composed surfaces @app @lab', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/lab/?v=chat-graph');
  await waitConnectedDirect(page);

  await expect(page.locator('lab-surface')).toBeVisible();
  await expect(page.locator('header.lab .variant-name')).toContainText('Chat');

  // Both regions of the split carry their surface.
  await expect(page.locator('section[data-area="chat"] ask-surface')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('section[data-area="graph"] graph-surface')).toBeVisible({ timeout: 10000 });
});

test('lab composer mounts the requested composition @app @lab', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/lab/?compose=1&layout=h&w=chat,graph&mode=2d&shape=graph&lens=belief&layer=both');
  await waitConnectedDirect(page);

  // The composer's controls are the dimensions of the space.
  await expect(page.locator('.controls select[aria-label="Layout"]')).toHaveValue('h');
  await expect(page.locator('.controls select[aria-label="Lens"]')).toHaveValue('belief');

  await expect(page.locator('section[data-area="a"] ask-surface')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('section[data-area="b"] graph-surface')).toBeVisible({ timeout: 10000 });
});
