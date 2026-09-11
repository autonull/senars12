/**
 * MCP Response Helpers
 * Shared JSON serialization for MCP tools and resources
 */

import type {CallToolResult} from '@modelcontextprotocol/sdk/types.js';

export interface MCPStructuredContent<T = unknown> {
    content: Array<{type: 'text'; text: string}>;
    structuredContent?: T;
}

/**
 * Creates a standardized MCP tool response with text content and structured content
 */
export function createMCPResponse<T extends Record<string, unknown>>(
    text: string,
    structuredContent: T
): MCPStructuredContent<T> {
    return {
        content: [{type: 'text', text}],
        structuredContent,
    };
}

/**
 * Creates a simple text-only MCP response
 */
export function createMCPTextResponse(text: string): MCPStructuredContent {
    return {
        content: [{type: 'text', text}],
    };
}

/**
 * Formats beliefs array for MCP responses
 */
export function formatBeliefsForMCP(beliefs: Array<{term: {toString(): string}; truth?: unknown}>): Array<{
    term: string;
    truth: unknown;
}> {
    return beliefs.map((b) => ({
        term: b.term.toString(),
        truth: b.truth,
    }));
}

/**
 * Formats concepts array for MCP responses
 */
export function formatConceptsForMCP(concepts: Array<{term: string; priority: number}>): Array<{
    term: string;
    priority: number;
}> {
    return concepts.map((c) => ({term: c.term, priority: c.priority}));
}

/**
 * Formats episodic memory entries for MCP responses
 */
export function formatEpisodesForMCP(episodes: Array<{
    type: string;
    content: string;
    timestamp?: number;
}>): Array<{
    type: string;
    content: string;
    timestamp?: number;
}> {
    return episodes;
}

/**
 * JSON stringifies with pretty printing for MCP text content
 */
export const stringifyMCP = (value: unknown): string => JSON.stringify(value, null, 2);

/**
 * Safe JSON parse with fallback
 */
export function safeJSONParse<T>(text: string, fallback: T): T {
    try {
        return JSON.parse(text) as T;
    } catch {
        return fallback;
    }
}