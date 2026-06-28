import { Page } from '@playwright/test';

export class TestApiClient {
  constructor(private page: Page) {}

  async ensureReady() {
    // Wait for base test API (from entry.ts)
    await this.page.waitForFunction(() => (window as any).__testApi !== undefined, { timeout: 10000 });
    // Wait for at least one component test API to be ready (indicates app is rendered)
    await this.page.waitForFunction(
      () => (window as any).__testApi?.chat !== undefined ||
            (window as any).__testApi?.graph !== undefined ||
            (window as any).__testApi?.workingMemory !== undefined ||
            (window as any).__testApi?.config !== undefined ||
            (window as any).__testApi?.telemetry !== undefined,
      { timeout: 15000 }
    );
  }

  // Wait for specific component test API
  async waitForGraphApi() {
    await this.page.waitForFunction(() => (window as any).__testApi?.graph !== undefined, { timeout: 10000 });
  }

  async waitForWorkingMemoryApi() {
    await this.page.waitForFunction(() => (window as any).__testApi?.workingMemory !== undefined, { timeout: 10000 });
  }

  async waitForConfigApi() {
    await this.page.waitForFunction(() => (window as any).__testApi?.config !== undefined, { timeout: 10000 });
  }

  async waitForTelemetryApi() {
    await this.page.waitForFunction(() => (window as any).__testApi?.telemetry !== undefined, { timeout: 10000 });
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
