import { test, expect } from '../../framework/fixtures/senars-app';

test('malicious markdown does not execute scripts', async ({ chat, testControl, page }) => {
  const maliciousPayload = '<script>alert("xss")</script>';
  await testControl.injectChatResponse(maliciousPayload, maliciousPayload);

  await chat.sendMessage('Render this');
  await chat.waitForResponse();

  const latest = await chat.getLatestMessage();
  expect(latest.content).not.toContain('<script>');
});
