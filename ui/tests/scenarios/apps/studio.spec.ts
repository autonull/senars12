import { expect, test } from '../../framework/fixtures/senars-app';
import { waitConnectedDirect } from '../../framework/utils/interactions';

test.describe.configure({ retries: 0 });

/**
 * The Studio is one shell + one composition viewport. A preset (`?preset=`) is
 * data: the shell renders the chrome and mounts each cell's surface into the
 * grid. The same mechanism must handle a nested composition (a cell that is
 * itself a composition) and reflect control changes in the URL.
 */
test('studio preset mounts its composed surfaces @app @studio', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/studio/?preset=chat-graph');
  await waitConnectedDirect(page);

  await expect(page.locator('app-chrome')).toContainText('Studio');

  await expect(page.locator('section[data-area="a"] ask-surface')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('section[data-area="b"] graph-surface')).toBeVisible({ timeout: 10000 });
});

test('studio renders a nested composition @app @studio', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/studio/?preset=study');
  await waitConnectedDirect(page);

  const nested = page.locator('section[data-area="a"] composition-view[data-composition="chat-graph"]');
  await expect(nested.locator('section[data-area="a"] ask-surface')).toBeVisible({ timeout: 10000 });
  await expect(nested.locator('section[data-area="b"] graph-surface')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('section[data-area="b"] notebook-surface')).toBeVisible({ timeout: 10000 });
});

test('studio controls mutate the URL @app @studio', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/studio/?preset=chat-graph');
  await waitConnectedDirect(page);

  await page.locator('select[aria-label="Layout"]').selectOption('v');
  await expect.poll(() => page.url()).toContain('layout=v');
  await expect.poll(() => page.url()).toContain('preset=chat-graph');
});
