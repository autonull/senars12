export interface DispatchCall {
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
}

export interface DispatchContext {
  tools: Record<string, { execute: (args: Record<string, unknown>) => Promise<unknown> }>;
}

export interface DispatchArtifact {
  type: string;
  content?: unknown;
  metadata?: Record<string, unknown>;
}

export interface DispatchError {
  message: string;
}

export async function dispatchToolCalls(
  calls: DispatchCall[],
  ctx: DispatchContext
): Promise<{ artifacts: DispatchArtifact[]; errors: DispatchError[] }> {
  const artifacts: DispatchArtifact[] = [];
  const errors: DispatchError[] = [];

  for (const call of calls) {
    const tool = ctx.tools[call.toolName];
    if (!tool) {
      errors.push({ message: `Tool not found: ${call.toolName}` });
      continue;
    }
    try {
      const result = await tool.execute(call.args);
      if (
        call.toolName === 'nar_believe' &&
        result &&
        typeof result === 'object' &&
        'success' in result
      ) {
        const r = result as Record<string, unknown>;
        if (r.success) {
          artifacts.push({
            type: 'belief_added',
            content: r.statement,
            metadata: { toolCallId: call.toolCallId },
          });
        }
      }
      artifacts.push({
        type: 'tool_result',
        content: result,
        metadata: { toolName: call.toolName, toolCallId: call.toolCallId },
      });
    } catch (e: unknown) {
      errors.push({ message: (e as Error).message });
    }
  }

  return { artifacts, errors };
}
