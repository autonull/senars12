import type { ApprovalManagerOptions, ApprovalRequest, ApprovalResult } from '@senars/core';
import { InMemoryApprovalManager } from '@senars/core';
import { tool } from 'ai';
import { z } from 'zod';

/** Pending-approval registry shared with core's `ApprovalService` — one implementation. */
export const ApprovalManager = InMemoryApprovalManager;

export type { ApprovalManagerOptions, ApprovalRequest, ApprovalResult };

export function createHumanApprovalTool(manager: InMemoryApprovalManager) {
  return {
    human_approval: tool({
      description:
        'Request human approval before proceeding with an action. Pauses until a human approves or rejects.',
      inputSchema: z.strictObject({
        request: z.string().describe('Clear description of what you want approval for'),
        context: z.string().optional().describe('Additional context to help the human decide'),
      }),
      execute: async ({ request, context }) => {
        const fullRequest = context ? `${request}\n\nContext: ${context}` : request;
        const req = manager.createRequest(fullRequest, { timestamp: Date.now() });
        const result = await req.result;
        return {
          id: req.id,
          request: fullRequest,
          approved: result.approved,
          reason: result.reason,
        };
      },
    }),
  };
}
