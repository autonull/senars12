import type { Connection, IOMessage } from '../types.js';

export const resolveReplyTarget = (connection: Connection, message: IOMessage): string => {
  if (connection.type !== 'irc') return message.sender;
  const parts = message.origin.split(':');
  const channel = parts[1];
  if (channel && channel !== 'direct') return channel;
  return message.sender;
};
