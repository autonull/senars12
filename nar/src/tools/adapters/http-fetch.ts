import { tool } from 'ai';
import { z } from 'zod';

// --- http_fetch ---

export function createHTTPFetchTools() {
  return {
    http_fetch: tool({
      description:
        'Make HTTP requests. Supports GET, POST, PUT, DELETE. Returns status, headers, and body.',
      inputSchema: z.strictObject({
        url: z.string().describe('Full URL to fetch (http/https only)'),
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional().default('GET'),
        headers: z.record(z.string(), z.string()).optional().describe('Optional request headers'),
        body: z.string().optional().describe('Request body for POST/PUT'),
        timeout: z
          .number()
          .min(1000)
          .max(60_000)
          .optional()
          .default(15_000)
          .describe('Timeout in ms'),
      }),
      execute: async ({ url: urlStr, method = 'GET', headers = {}, body, timeout = 15_000 }) => {
        try {
          const parsed = new URL(urlStr);
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return { error: 'Only http/https URLs are allowed' };
          }
          const response = await fetch(urlStr, {
            method,
            headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
            body: body || undefined,
            signal: AbortSignal.timeout(timeout),
          });
          const bodyText = await response.text();
          const responseHeaders: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });
          return {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            body: bodyText,
            bodyLength: bodyText.length,
          };
        } catch (error) {
          return { error: String(error) };
        }
      },
    }),
  };
}
