import type { Agent } from '../Agent.js';

export async function aggregateChatResponse(agent: Agent, text: string): Promise<string> {
  let response = '';
  if (typeof agent.chat === 'function') {
    for await (const evt of agent.chat(text)) {
      if (evt.kind === 'text-delta' && evt.text) response += evt.text;
    }
  }
  return response;
}
