/**
 * Server error frame.
 *
 * The boundary used to reject a malformed client message by logging to stdout
 * and staying silent, so a control could fail without the UI ever knowing. This
 * is the one typed reply every rejected message gets.
 */
import { z } from 'zod';
import { msg } from './envelope.js';

export const ServerErrorCode = z.enum([
  'invalid_message',
  'unsupported',
  'not_available',
  'internal',
]);
export type ServerErrorCode = z.infer<typeof ServerErrorCode>;

export const ServerError = msg('server.error', {
  code: ServerErrorCode,
  message: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
});
export type ServerError = z.infer<typeof ServerError>;
