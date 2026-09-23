import type { ChatStreamAgent } from './types.js';

export async function aggregateChatResponse(agent: ChatStreamAgent, text: string): Promise<string> {
  let response = '';
  if (typeof agent.chat === 'function') {
    for await (const evt of agent.chat(text)) {
      if (evt.kind === 'text-delta' && evt.text) response += evt.text;
    }
  }
  return response;
}
