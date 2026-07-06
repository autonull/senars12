import type { Page } from '@playwright/test';

export class TestApiClient {
  constructor(private page: Page) {}

  async ensureReady() {
    await this.page.waitForFunction(
      () => (window as Record<string, unknown>).__testApi !== undefined,
      { timeout: 10000 }
    );
  }

  async waitForComponentApi(component: string) {
    await this.page.waitForFunction(
      (name: string) => ((window as Record<string, unknown>).__testApi as Record<string, unknown>)?.[name] !== undefined,
      component,
      { timeout: 10000 }
    );
  }

  async getGraphNodeCount(): Promise<number> {
    return this.page.evaluate(() => {
      const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
      return Number(api?.graph?.getNodeCount?.() ?? 0);
    });
  }

  async getGraphEdgeCount(): Promise<number> {
    return this.page.evaluate(() => {
      const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
      return Number(api?.graph?.getEdgeCount?.() ?? 0);
    });
  }

  async getNodeData(nodeId: string): Promise<Record<string, unknown>> {
    return this.page.evaluate((id) => {
      const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
      return (api?.graph?.getNodeData?.(id) ?? {}) as Record<string, unknown>;
    });
  }

  async clickNode(nodeId: string): Promise<void> {
    await this.page.evaluate((id) => {
      const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
      api?.graph?.clickNode?.(id);
    });
  }

  async clickEdge(source: string, target: string): Promise<void> {
    await this.page.evaluate(([s, t]) => {
      const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
      api?.graph?.clickEdge?.(s, t);
    });
  }

  async getAllNodeIds(): Promise<string[]> {
    return this.page.evaluate(() => {
      const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
      return (api?.graph?.getAllNodeIds?.() ?? []) as string[];
    });
  }

  async getAllEdgeIds(): Promise<string[]> {
    return this.page.evaluate(() => {
      const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
      return (api?.graph?.getAllEdgeIds?.() ?? []) as string[];
    });
  }

  async getEdgeData(source: string, target: string): Promise<Record<string, unknown>> {
    return this.page.evaluate(([s, t]) => {
      const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
      return (api?.graph?.getEdgeData?.(s, t) ?? {}) as Record<string, unknown>;
    });
  }

  async getWorkingMemoryTerms(): Promise<string[]> {
    return this.page.evaluate(() => {
      const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
      return (api?.workingMemory?.getTerms?.() ?? []) as string[];
    });
  }

  async getConnectionState(): Promise<string> {
    return this.page.evaluate(() => {
      const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
      return String(api?.connection?.getState?.() ?? 'disconnected');
    });
  }

  async getStoreState(path: string): Promise<string> {
    return this.page.evaluate((p) => {
      const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
      return String(api?.store?.getState?.(p) ?? '');
    });
  }
}