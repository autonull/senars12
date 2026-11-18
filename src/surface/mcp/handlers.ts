/**
 * MCP Handlers — request handlers for generated MCP surface.
 *
 * Handles all MCP methods with deterministic, replayable responses.
 */

import type {
  MCPServer,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPRequest,
  MCPResponse,
  MCPNotification,
  InitializeParams,
  InitializeResult,
  ListToolsParams,
  ListToolsResult,
  CallToolParams,
  ListResourcesParams,
  ListResourcesResult,
  ReadResourceParams,
  ReadResourceResult,
  ListPromptsParams,
  ListPromptsResult,
  MCPToolResult,
  MCPPromptResult,
  GetPromptParams,
  MCPError,
} from './types.js';
import { getTask, updateTask, cleanTasks } from './server.js';

/** Create initialize handler. */
export function createInitializeHandler(server: MCPServer) {
  return async (params: InitializeParams): Promise<InitializeResult> => {
    return {
      protocolVersion: server.config.protocolVersion,
      capabilities: server.config.capabilities,
      serverInfo: {
        name: server.config.name,
        version: server.config.version,
      },
    };
  };
}

/** Create list tools handler. */
export function createListToolsHandler(server: MCPServer) {
  return async (params: ListToolsParams): Promise<ListToolsResult> => {
    const tools: MCPTool[] = Array.from(server.tools.values());
    return { tools };
  };
}

/** Create call tool handler. */
export function createCallToolHandler(server: MCPServer) {
  return async (params: CallToolParams): Promise<MCPToolResult> => {
    const tool = server.tools.get(params.name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Tool not found: ${params.name}` }],
        isError: true,
      };
    }

    try {
      // Check if tool is long-running (has task support)
      const result = await tool.handler(params.arguments ?? {});

      // If result indicates a task handle, return it
      if (result.content && typeof result.content === 'object' && 'taskId' in result.content) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ taskId: result.content.taskId }) }],
        };
      }

      return result;
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  };
}

/** Create list resources handler. */
export function createListResourcesHandler(server: MCPServer) {
  return async (params: ListResourcesParams): Promise<ListResourcesResult> => {
    const resources: MCPResource[] = Array.from(server.resources.values());
    return { resources };
  };
}

/** Create read resource handler. */
export function createReadResourceHandler(server: MCPServer) {
  return async (params: ReadResourceParams): Promise<ReadResourceResult> => {
    const resource = server.resources.get(params.uri);
    if (!resource) {
      throw new Error(`Resource not found: ${params.uri}`);
    }

    // In a real implementation, fetch resource content
    return {
      contents: [{
        uri: resource.uri,
        mimeType: resource.mimeType,
        text: JSON.stringify({ uri: resource.uri, name: resource.name }),
      }],
    };
  };
}

/** Create list prompts handler. */
export function createListPromptsHandler(server: MCPServer) {
  return async (params: ListPromptsParams): Promise<ListPromptsResult> => {
    const prompts: MCPPrompt[] = Array.from(server.prompts.values());
    return { prompts };
  };
}

/** Create get prompt handler. */
export function createGetPromptHandler(server: MCPServer) {
  return async (params: GetPromptParams): Promise<MCPPromptResult> => {
    const prompt = server.prompts.get(params.name);
    if (!prompt) {
      throw new Error(`Prompt not found: ${params.name}`);
    }

    return await prompt.handler(params.arguments ?? {});
  };
}

/** Create task get handler. */
export function createTaskGetHandler(server: MCPServer) {
  return async (params: { taskId: string }): Promise<{ task: { id: string; status: string; result?: unknown; error?: string } }> => {
    const task = getTask(server, params.taskId);
    if (!task) {
      throw new Error(`Task not found: ${params.taskId}`);
    }

    return {
      task: {
        id: task.id,
        status: task.status,
        result: task.result,
        error: task.error,
      },
    };
  };
}

/** Create task list handler. */
export function createTaskListHandler(server: MCPServer) {
  return async (): Promise<{ tasks: Array<{ id: string; tool: string; status: string }> }> => {
    cleanTasks(server);
    const tasks = Array.from(server.tasks.values()).map(t => ({
      id: t.id,
      tool: t.tool,
      status: t.status,
    }));
    return { tasks };
  };
}

/** Route MCP request to handler. */
export async function routeRequest(
  server: MCPServer,
  request: MCPRequest
): Promise<MCPResponse> {
  const handlers: Record<string, (params: unknown) => Promise<unknown>> = {
    initialize: createInitializeHandler(server) as (params: unknown) => Promise<unknown>,
    'tools/list': createListToolsHandler(server) as (params: unknown) => Promise<unknown>,
    'tools/call': createCallToolHandler(server) as (params: unknown) => Promise<unknown>,
    'resources/list': createListResourcesHandler(server) as (params: unknown) => Promise<unknown>,
    'resources/read': createReadResourceHandler(server) as (params: unknown) => Promise<unknown>,
    'prompts/list': createListPromptsHandler(server) as (params: unknown) => Promise<unknown>,
    'prompts/get': createGetPromptHandler(server) as (params: unknown) => Promise<unknown>,
    'tasks/get': createTaskGetHandler(server) as (params: unknown) => Promise<unknown>,
    'tasks/list': createTaskListHandler(server) as (params: unknown) => Promise<unknown>,
  };

  const handler = handlers[request.method];
  if (!handler) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32601, message: `Method not found: ${request.method}` },
    };
  }

  try {
    const result = await handler(request.params ?? {});
    return {
      jsonrpc: '2.0',
      id: request.id,
      result,
    };
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/** Handle MCP notification. */
export function handleNotification(
  server: MCPServer,
  notification: MCPNotification
): void {
  // Notifications don't require responses
  switch (notification.method) {
    case 'notifications/initialized':
      // Client initialized
      break;
    case 'notifications/cancelled':
      // Cancel long-running operation
      break;
  }
}