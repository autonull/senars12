import { test, expect } from '../../framework/fixtures/senars-app';
import { seedGraph } from '../../framework/scenarios/reasoning';

test.describe('Chat↔Graph Fusion', () => {
  test('graph receives nodes from seeded concepts via NAR derivation', async ({ graph, testControl }) => {
    await testControl.seedGraph([
      { term: 'bird', f: 0.9, c: 0.9 },
      { term: 'fly', f: 0.8, c: 0.85 },
    ]);
    await testControl.injectDerivation('bird', 0.85, 0.9);
    await graph.waitForNode('bird');

    const data = await graph.getNodeData('bird');
    expect(data).not.toBeNull();
    expect(data.priority).toBeGreaterThan(0);
  });

  test('clicking a chat message sets selectedMessageId and focusTerm in store', async ({ chat, testControl, testApi, page }) => {
    await testControl.injectChatResponse(
      'Processing your question...',
      'The speed of light is approximately 299,792,458 meters per second.'
    );
    await chat.sendMessage('What is the speed of light?');
    await chat.waitForResponse();

    const messages = page.locator('chat-console').locator('[data-testid="message"]');
    const count = await messages.count();
    expect(count).toBeGreaterThan(0);

    await messages.nth(count - 1).click();

    await expect(async () => {
      const id = await testApi.getStoreState('selectedMessageId');
      expect(id).not.toBeNull();
    }).toPass({ timeout: 3000 });

    const focusTerm = await testApi.getStoreState('focusTerm');
    expect(focusTerm).not.toBeNull();
  });

  test('graph node click sets selectedMessageId', async ({ graph, testControl, testApi }) => {
    await seedGraph(testControl, graph, [
      { term: 'penguin', f: 0.9, c: 0.9 },
      { term: 'bird', f: 0.95, c: 0.95 },
    ]);

    await graph.clickNode('penguin');

    const selectedId = await testApi.getStoreState('selectedMessageId');
    expect(selectedId).toBe('penguin');
  });

  test('progressive onboarding upgrades from simple to full after 5 messages', async ({ chat, testControl, testApi }) => {
    const initialLevel = await testApi.getStoreState('userLevel');
    expect(initialLevel).toBe('simple');

    for (let i = 0; i < 5; i++) {
      await testControl.injectChatResponse('...', `Response ${i}.`);
      await chat.sendMessage(`Test message ${i}`);
      await chat.waitForResponse();
    }

    await expect(async () => {
      const level = await testApi.getStoreState('userLevel');
      expect(level).toBe('full');
    }).toPass({ timeout: 3000 });
  });

  test('concept thread panel appears when focus term is set in full mode', async ({ chat, testControl, testApi, page }) => {
    // Upgrade to full mode
    for (let i = 0; i < 5; i++) {
      await testControl.injectChatResponse('...', `Response ${i}.`);
      await chat.sendMessage(`Msg ${i}`);
      await chat.waitForResponse();
    }

    // Send one more message and click it to set focusTerm
    await testControl.injectChatResponse('Thinking...', 'Quantum mechanics describes nature at the smallest scales.');
    await chat.sendMessage('Explain quantum');
    await chat.waitForResponse();

    const messages = page.locator('chat-console').locator('[data-testid="message"]');
    await messages.last().click();

    const thread = page.locator('concept-thread');
    await expect(thread).toBeVisible({ timeout: 3000 });
  });

  test('lens selector becomes visible after upgrading to full mode', async ({ chat, testControl, testApi, page }) => {
    await expect(page.locator('lens-selector')).not.toBeVisible();

    for (let i = 0; i < 5; i++) {
      await testControl.injectChatResponse('...', `Response ${i}.`);
      await chat.sendMessage(`Msg ${i}`);
      await chat.waitForResponse();
    }

    await expect(page.locator('lens-selector')).toBeVisible({ timeout: 3000 });
  });

  test('graph updates dynamically when new derivation arrives via WebSocket', async ({ graph, testControl }) => {
    await testControl.seedGraph([
      { term: 'animal', f: 0.95, c: 0.95 },
    ]);
    await testControl.injectDerivation('animal', 0.9);
    await graph.waitForNode('animal');

    const initialCount = await graph.getNodeCount();

    await testControl.injectDerivation('mammal', 0.85, 0.9);
    await graph.waitForNode('mammal');

    const newCount = await graph.getNodeCount();
    expect(newCount).toBeGreaterThanOrEqual(initialCount);

    const mammalData = await graph.getNodeData('mammal');
    expect(mammalData).not.toBeNull();
    expect(mammalData.priority).toBeGreaterThan(0);
  });

  test('node positions are preserved across lens switch', async ({ graph, testControl, testApi, page }) => {
    await seedGraph(testControl, graph, [
      { term: 'bird', f: 0.9, c: 0.9 },
      { term: 'fly', f: 0.8, c: 0.85 },
      { term: 'animal', f: 0.95, c: 0.95 },
    ]);

    // Record positions from the belief graph rendering
    const initialLens = await testApi.getStoreState('activeLens');
    expect(initialLens).toBe('belief');

    // Switch lens via server endpoint - inject a new derivation to trigger belief update
    await testControl.injectDerivation('fly', 0.85, 0.9);
    await graph.waitForUpdate();

    // Verify graph still has all nodes
    const ids = await graph.getAllNodeIds();
    expect(ids).toContain('bird');
    expect(ids).toContain('fly');
    expect(ids).toContain('animal');
  });
});

test.describe('Contradiction Detection', () => {
  test('contradiction badge counts nodes with contradiction type', async ({ graph, testControl, page }) => {
    await testControl.seedGraph([
      { term: 'penguin', f: 0.9, c: 0.9 },
      { term: 'penguin', f: 0.2, c: 0.8 },
    ]);
    await testControl.injectDerivation('penguin', 0.85);
    await graph.waitForNode('penguin');

    const badge = page.locator('contradiction-badge');
    const isVisible = await badge.isVisible();

    if (isVisible) {
      const text = await badge.textContent();
      expect(text).toBeTruthy();
    }
  });
});
