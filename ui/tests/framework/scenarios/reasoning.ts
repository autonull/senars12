import { expect } from '@playwright/test';
import { BeliefGraph } from '../components/belief.graph';
import { TestControl } from '../utils/test-control';

export async function seedGraph(
  testControl: TestControl,
  graph: BeliefGraph,
  concepts: Array<{ term: string; f: number; c: number }>
) {
  await testControl.seedGraph(concepts);
  // Trigger a derivation to ensure the graph updates with the new concepts
  await testControl.injectDerivation('seedConcept', 0.5);
  await graph.waitForUpdate();
}

export async function triggerDerivation(
  testControl: TestControl,
  graph: BeliefGraph,
  conclusionId: string,
  frequency: number = 0.85,
  confidence: number = 0.9
) {
  const initialCount = await graph.getNodeCount();

  await testControl.injectDerivation(conclusionId, frequency, confidence);

  await expect(async () => {
    const count = await graph.getNodeCount();
    expect(count).toBeGreaterThan(initialCount);
  }).toPass({ timeout: 3000 });

  const data = await graph.getNodeData(conclusionId);
  expect(data).not.toBeNull();
  expect(data.priority).toBeGreaterThan(0);
}

export async function simulateHighThroughput(
  testControl: TestControl,
  graph: BeliefGraph,
  eventsPerSec: number,
  durationSec: number
) {
  const totalEvents = eventsPerSec * durationSec;
  const startTime = Date.now();

  for (let i = 0; i < totalEvents; i++) {
    await testControl.injectDerivation(`concept-${i}`, 0.5 + Math.random() * 0.5);
  }

  const elapsed = Date.now() - startTime;
  const actualRate = totalEvents / (elapsed / 1000);
  expect(actualRate).toBeGreaterThan(eventsPerSec * 0.5);

  const nodeCount = await graph.getNodeCount();
  expect(nodeCount).toBeLessThanOrEqual(300);
}
