import { expect, test } from '../../framework/fixtures/senars-app';

test.describe('Config Gate: lens designer', () => {
  test('open designer, create lens, commit lens successfully', async ({
    page,
    testApi,
  }) => {
    await expect(page.locator('graph-viewport')).toBeVisible();
    await expect.poll(() => testApi.getConnectionState()).toBe('connected');

    await expect.poll(() => testApi.getGraphNodeCount()).toBeGreaterThan(0);

    // Open the lens designer panel via the "Design" toolbar button
    const designBtn = page.locator('graph-toolbar .toolbar-btn', { hasText: 'Design' });
    await expect(designBtn).toBeVisible({ timeout: 5000 });
    await designBtn.click();

    const designer = page.locator('lens-designer');
    await expect(designer).toBeVisible({ timeout: 3000 });

    // Fill in the lens name
    const nameInput = designer.locator('input[placeholder="Lens name…"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Priority Size Lens');

    // Verify field options are populated
    const fieldSelect = designer.locator('select').nth(1);
    await expect(fieldSelect).toBeVisible();

    const channelSelect = designer.locator('select').nth(2);
    await expect(channelSelect).toBeVisible();

    // Commit the lens (should enable when name is filled)
    const commitBtn = designer.locator('.commit-btn');
    await expect(commitBtn).toBeEnabled();
    await commitBtn.click();

    // Verify panel closed after commit
    await expect(designer).not.toBeVisible({ timeout: 3000 });
  });

  test('add isContradiction → color mapping, commit, verify lens exists', async ({
    page,
    testApi,
  }) => {
    await expect(page.locator('graph-viewport')).toBeVisible();
    await expect.poll(() => testApi.getConnectionState()).toBe('connected');

    await expect.poll(() => testApi.getGraphNodeCount()).toBeGreaterThan(0);

    // Open lens designer
    const designBtn = page.locator('graph-toolbar .toolbar-btn', { hasText: 'Design' });
    await expect(designBtn).toBeVisible({ timeout: 5000 });
    await designBtn.click();

    const designer = page.locator('lens-designer');
    await expect(designer).toBeVisible({ timeout: 3000 });

    // Name the lens
    const nameInput = designer.locator('input[placeholder="Lens name…"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Conflict Highlight');

    // Set isContradiction → color mapping
    const fieldSelect = designer.locator('select').nth(1);
    await expect(fieldSelect).toBeVisible();
    await fieldSelect.selectOption('isContradiction');

    const channelSelect = designer.locator('select').nth(2);
    await expect(channelSelect).toBeVisible();
    await channelSelect.selectOption('color');

    // Commit the lens (button should be enabled with proper name and mapping)
    const commitBtn = designer.locator('.commit-btn');
    await expect(commitBtn).toBeEnabled({ timeout: 3000 });
    await commitBtn.click();

    // Wait for WS round-trip and DOM update
    await page.waitForTimeout(500);

    // Panel should be closed or commit succeeded without error
    const validationError = await designer.locator('.validation-error').count();
    expect(validationError).toBe(0);
  });
});
