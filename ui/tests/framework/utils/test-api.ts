import { Page } from '@playwright/test';

export class TestApiClient {
  constructor(private page: Page) {}

  async ensureReady() {
    await this.page.waitForFunction(() => (window as any).__testApi !== undefined, { timeout: 10000 });
  }

  async waitForComponentApi(component: string) {
    await this.page.waitForFunction(
      (name: string) => (window as any).__testApi?.[name] !== undefined,
      component,
      { timeout: 10000 }
    );
  }

  async getGraphNodeCount(): Promise<number> {
    return this.page.evaluate(() => (window as any).__testApi.graph.getNodeCount());
  }

  async getGraphEdgeCount(): Promise<number> {
    return this.page.evaluate(() => (window as any).__testApi.graph.getEdgeCount());
  }

  async getNodeData(nodeId: string): Promise<any> {
    return this.page.evaluate((id) => (window as any).__testApi.graph.getNodeData(id), nodeId);
  }

  async clickNode(nodeId: string): Promise<void> {
    await this.page.evaluate((id) => (window as any).__testApi.graph.clickNode(id), nodeId);
  }

  async getAllNodeIds(): Promise<string[]> {
    return this.page.evaluate(() => (window as any).__testApi.graph.getAllNodeIds());
  }

  async getWorkingMemoryTerms(): Promise<string[]> {
    return this.page.evaluate(() => (window as any).__testApi.workingMemory.getTerms());
  }

  async getConnectionState(): Promise<string> {
    return this.page.evaluate(() => (window as any).__testApi.connection.getState());
  }

  async getStoreState(path: string): Promise<any> {
    return this.page.evaluate((p) => (window as any).__testApi.store.getState(p), path);
  }
}
