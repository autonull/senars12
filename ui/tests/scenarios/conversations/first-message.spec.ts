import { test, expect } from '../../framework/fixtures/senars-app';
import { sendAndReceiveMessage } from '../../framework/scenarios/conversation';

test('user can send first message and receive streamed response', async ({ chat, testControl }) => {
  const response = await sendAndReceiveMessage(
    chat, testControl,
    'Analyze the current state',
    /processed.*analysis complete/i
  );

  expect(response.role).toBe('agent');
  expect(response.content).toContain('Analysis complete');

  const count = await chat.getMessageCount();
  expect(count).toBe(2);
});
