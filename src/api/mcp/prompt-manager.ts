/**
 * MCP Prompt Manager
 * Handles prompt primitive for MCP protocol
 */

import {PromptTemplate, PromptArgument, MCPMessage, MCPContent} from './types.js';
import {Logger, LoggerFactory} from '../../nar/logger/index.js';

/**
 * Prompt renderer interface
 */
export interface PromptRenderer {
	/**
	 * Render template with arguments
	 */
	render(
		template: PromptTemplate,
		args: Record<string, unknown>
	): MCPMessage[];

	/**
	 * List available prompts
	 */
	list(): PromptTemplate[];
}

/**
 * Prompt manager for MCP prompts
 */
export class PromptManager implements PromptRenderer {
	private prompts: Map<string, PromptTemplate> = new Map();
	private logger: Logger;

	constructor() {
		this.logger = LoggerFactory.getInstance().get('api:mcp:prompts');
	}

	/**
	 * Register a prompt template
	 */
	registerPrompt(template: PromptTemplate): void {
		this.prompts.set(template.name, template);
		this.logger.info(`Registered prompt: ${template.name}`);
	}

	/**
	 * Unregister a prompt
	 */
	unregisterPrompt(name: string): void {
		this.prompts.delete(name);
		this.logger.info(`Unregistered prompt: ${name}`);
	}

	/**
	 * Get a prompt template by name
	 */
	getPrompt(name: string): PromptTemplate | undefined {
		return this.prompts.get(name);
	}

	/**
	 * List all registered prompts
	 */
	listPrompts(): PromptTemplate[] {
		return Array.from(this.prompts.values());
	}

	/**
	 * List available prompts (PromptRenderer interface)
	 */
	list(): PromptTemplate[] {
		return this.listPrompts();
	}

	/**
	 * Render a prompt with provided arguments
	 */
	render(
		template: PromptTemplate,
		args: Record<string, unknown>
	): MCPMessage[] {
		this.logger.info(`Rendering prompt: ${template.name}`);

		// Validate arguments
		if (template.arguments) {
			this.validateArguments(template.arguments, args);
		}

		// Build messages from template
		const messages: MCPMessage[] = [];

		// Example: Create a system message from prompt
		const systemContent: MCPContent[] = [
			{
				type: 'text',
				text: `Prompt: ${template.name}\n${template.description || ''}`,
			},
		];

		// Add argument values if provided
		if (template.arguments && template.arguments.length > 0) {
			const argText = template.arguments
				.map(
					(arg) =>
						`${arg.name}: ${
							args[arg.name] !== undefined
								? String(args[arg.name])
								: '<not provided>'
						}`
				)
				.join('\n');

			systemContent.push({
				type: 'text',
				text: `\nArguments:\n${argText}`,
			});
		}

		messages.push({
			role: 'system',
			content: systemContent,
		});

		return messages;
	}

	/**
	 * Validate prompt arguments
	 */
	private validateArguments(
		expected: PromptArgument[],
		provided: Record<string, unknown>
	): void {
		for (const arg of expected) {
			if (arg.required && provided[arg.name] === undefined) {
				throw new Error(
					`Missing required argument: ${arg.name}`
				);
			}
		}
	}

	/**
	 * Create a message from template
	 */
	createMessage(
		role: 'user' | 'assistant' | 'system',
		content: string
	): MCPMessage {
		return {
			role,
			content: [
				{
					type: 'text',
					text: content,
				},
			],
		};
	}

	/**
	 * Append user message to conversation
	 */
	appendUserMessage(text: string): MCPMessage {
		return this.createMessage('user', text);
	}

	/**
	 * Append assistant message to conversation
	 */
	appendAssistantMessage(text: string): MCPMessage {
		return this.createMessage('assistant', text);
	}

	/**
	 * Append system message to conversation
	 */
	appendSystemMessage(text: string): MCPMessage {
		return this.createMessage('system', text);
	}
}
