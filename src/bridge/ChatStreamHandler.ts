import { collectText } from '@senars/util/text';
import type { ChatStreamAgent } from './types';

export async function aggregateChatResponse(agent: ChatStreamAgent, text: string): Promise<string> {
  return typeof agent.chat === 'function' ? collectText(agent.chat(text)) : '';
}
