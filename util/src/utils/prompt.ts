/** Extract the concatenated text of the last user message in an AI-SDK prompt. */
export function extractLastUserMessage(messages: Array<{ role?: string; content: unknown }>): string {
  if (!messages || messages.length === 0) return '';
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) return '';
  const c = lastUser.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c))
    return c
      .map((p: { type?: string; text?: string }) => (p.type === 'text' ? p.text : ''))
      .join('');
  return '';
}
