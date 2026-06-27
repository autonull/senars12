import { Page, Locator, expect } from '@playwright/test';
import { TestApiClient } from '../utils/test-api';

export class BeliefGraph {
  private readonly root: Locator;
  private readonly truncationWarning: Locator;
  private readonly testApi: TestApiClient;

  constructor(private page: Page) {
    this.root = page.locator('belief-graph');
    this.truncationWarning = this.root.locator('[data-testid="truncation-warning"]');
    this.testApi = new TestApiClient(page);
  }

  async getNodeCount(): Promise<number> {
    return this.testApi.getGraphNodeCount();
  }

  async getEdgeCount(): Promise<number> {
    return this.testApi.getGraphEdgeCount();
  }

  async getNodeData(nodeId: string): Promise<any> {
    return this.testApi.getNodeData(nodeId);
  }

  async clickNode(nodeId: string): Promise<void> {
    await this.testApi.clickNode(nodeId);
  }

  async getAllNodeIds(): Promise<string[]> {
    return this.testApi.getAllNodeIds();
  }

  async waitForUpdate(timeout = 5000) {
    await expect(async () => {
      const count = await this.getNodeCount();
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout });
  }

  async waitForNode(nodeId: string, timeout = 5000) {
    await expect(async () => {
      const data = await this.getNodeData(nodeId);
      expect(data).not.toBeNull();
    }).toPass({ timeout });
  }

  async assertTruncated() {
    await expect(this.truncationWarning).toBeVisible();
  }

  async assertNotTruncated() {
    await expect(this.truncationWarning).not.toBeVisible();
  }
}
