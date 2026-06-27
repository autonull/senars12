import { Page, Locator, expect } from '@playwright/test';

export class ConfigDrawer {
  private readonly root: Locator;

  constructor(private page: Page) {
    this.root = page.locator('config-drawer');
  }

  async open() {
    const toggle = this.page.locator('[data-testid="config-toggle"]');
    if (await toggle.isVisible()) {
      await toggle.click();
    }
  }

  async setSlider(key: string, value: number) {
    const field = this.root.locator(`[data-testid="field-${key}"]`);
    const slider = field.locator('input[type="range"]');
    await slider.fill(value.toString());
  }

  async setDropdown(key: string, value: string) {
    const field = this.root.locator(`[data-testid="field-${key}"]`);
    const select = field.locator('select');
    await select.selectOption(value);
  }

  async setToggle(key: string, value: boolean) {
    const field = this.root.locator(`[data-testid="field-${key}"]`);
    const checkbox = field.locator('input[type="checkbox"]');
    if (value) await checkbox.check();
    else await checkbox.uncheck();
  }

  async getFieldValue(key: string): Promise<string> {
    const field = this.root.locator(`[data-testid="field-${key}"]`);
    const val = field.locator('.val');
    return (await val.textContent())?.trim() || '';
  }

  async assertFieldExists(key: string) {
    await expect(this.root.locator(`[data-testid="field-${key}"]`)).toBeVisible();
  }
}
