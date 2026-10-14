import { expect, test } from '../../framework/fixtures/senars-app';
import { waitConnected } from '../../framework/utils/interactions';

test.describe.configure({ retries: 0 });

test('console app loads, connects, and shows welcome message @app @console', async ({ page, testApi }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/console/');
  await waitConnected(testApi);

  // Verify the app shell is present
  await expect(page.locator('s-app-shell')).toBeVisible();

  // Verify the console surface is mounted
  await expect(page.locator('console-surface')).toBeVisible({ timeout: 10000 });

  // Verify welcome messages are shown
  await expect(page.locator('console-surface .log-entry')).toHaveCount(2, { timeout: 10000 });

  // Verify connection status shows connected
  await expect(page.locator('header .status')).toContainText('connected');
});

test('console app accepts Narsese input and shows output @app @console', async ({ page, testApi }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/console/');
  await waitConnected(testApi);

  await expect(page.locator('console-surface')).toBeVisible({ timeout: 10000 });

  // Type a Narsese belief
  await page.locator('console-surface input').fill('<sparrow --> bird>.');

  // Submit
  await page.locator('console-surface button[type="submit"]').click();

  // Verify input was logged
  await expect(page.locator('console-surface .log-entry .prefix.input')).toContainText('INPUT');

  // Verify output was logged (belief accepted)
  await expect(page.locator('console-surface .log-entry .prefix.output')).toContainText('OUTPUT', { timeout: 10000 });
});

test('console app handles commands @app @console', async ({ page, testApi }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/console/');
  await waitConnected(testApi);

  await expect(page.locator('console-surface')).toBeVisible({ timeout: 10000 });

  // Test :clear command
  await page.locator('console-surface input').fill(':clear');
  await page.locator('console-surface button[type="submit"]').click();

  // Verify log was cleared (only the clear message remains)
  await expect(page.locator('console-surface .log-entry .text').first()).toContainText('Cleared');

  // Test :events off command
  await page.locator('console-surface input').fill(':events off');
  await page.locator('console-surface button[type="submit"]').click();

  // Verify the last entry is "Events disabled"
  await expect(page.locator('console-surface .log-entry .text').last()).toContainText('Events disabled');
});

test('console app question mode works @app @console', async ({ page, testApi }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/console/');
  await waitConnected(testApi);

  await expect(page.locator('console-surface')).toBeVisible({ timeout: 10000 });

  // First assert a belief
  await page.locator('console-surface input').fill('<parrot --> bird>.');
  await page.locator('console-surface button[type="submit"]').click();

  // Wait for output
  await expect(page.locator('console-surface .log-entry .prefix.output').first()).toContainText('OUTPUT', { timeout: 10000 });

  // Now ask a question
  await page.locator('console-surface input').fill('<parrot --> bird>?');
  await page.locator('console-surface button[type="submit"]').click();

  // Verify question was logged as input
  await expect(page.locator('console-surface .log-entry .prefix.input').last()).toContainText('INPUT', { timeout: 10000 });

  // Verify answer was logged as output
  await expect(page.locator('console-surface .log-entry .prefix.output').last()).toContainText('OUTPUT', { timeout: 10000 });
});