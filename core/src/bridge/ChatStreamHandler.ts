import { collectText } from '@senars/util';
import type { ChatStreamAgent } from './types.js';

export async function aggregateChatResponse(agent: ChatStreamAgent, text: string): Promise<string> {
  return typeof agent.chat === 'function' ? collectText(agent.chat(text)) : '';
}
