import { expect } from '@playwright/test';
import { BeliefGraph } from '../components/belief.graph';
import { WsInterceptor } from '../fixtures/ws-interceptor';

export async function seedGraph(
  ws: WsInterceptor,
  graph: BeliefGraph,
  concepts: Array<{ id: string; priority: number; confidence: number }>
) {
  const ops = concepts.map(c => ({
    action: 'add_node' as const,
    id: c.id,
    data: { priority: c.priority, confidence: c.confidence },
  }));

  await ws.injectCognitiveDelta('belief_graph', ops);

  await graph.waitForNode(concepts[0]!.id);
}

export async function triggerDerivation(
  ws: WsInterceptor,
  graph: BeliefGraph,
  conclusionId: string,
  priority: number = 0.85
) {
  const initialCount = await graph.getNodeCount();

  await ws.injectCognitiveDelta('belief_graph', [
    { action: 'add_node', id: conclusionId, data: { priority, confidence: 0.9 } },
  ]);

  await expect(async () => {
    const count = await graph.getNodeCount();
    expect(count).toBeGreaterThan(initialCount);
  }).toPass({ timeout: 3000 });

  const data = await graph.getNodeData(conclusionId);
  expect(data).not.toBeNull();
  expect(data.priority).toBe(priority);
}

export async function simulateHighThroughput(
  ws: WsInterceptor,
  graph: BeliefGraph,
  eventsPerSecond: number,
  durationSec: number
) {
  const interval = 1000 / eventsPerSecond;
  const totalEvents = eventsPerSecond * durationSec;

  const startTime = Date.now();
  for (let i = 0; i < totalEvents; i++) {
    await ws.injectCognitiveDelta('belief_graph', [
      {
        action: 'add_node',
        id: `concept-${i}`,
        data: { priority: 0.5 + Math.random() * 0.5, confidence: 0.5 + Math.random() * 0.5 },
      },
    ]);
    await new Promise(r => setTimeout(r, interval));
  }

  const elapsed = Date.now() - startTime;
  const actualRate = totalEvents / (elapsed / 1000);

  expect(actualRate).toBeGreaterThan(eventsPerSecond * 0.8);

  const nodeCount = await graph.getNodeCount();
  expect(nodeCount).toBeLessThanOrEqual(300);
}
