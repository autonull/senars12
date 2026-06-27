import { Page, Locator } from '@playwright/test';

export class TelemetryPanel {
  private readonly root: Locator;

  constructor(private page: Page) {
    this.root = page.locator('telemetry-panel');
  }

  async getCanvasDimensions(): Promise<{ width: number; height: number }> {
    return this.root.locator('canvas').evaluate((el) => {
      const canvas = el as HTMLCanvasElement;
      return { width: canvas.width, height: canvas.height };
    });
  }
}
