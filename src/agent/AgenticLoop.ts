import type {IOMessage} from '../io/types.js';
import {MessageQueue} from './MessageQueue.js';
import type {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';

export interface AgenticLoopConfig {
	maxInputTurns: number;
	maxWakeTurns: number;
	sleepIntervalMs: number;
	wakeupIntervalMs: number;
}

const DEFAULT_CONFIG: Required<AgenticLoopConfig> = {
	maxInputTurns: 50,
	maxWakeTurns: 3,
	sleepIntervalMs: 1000,
	wakeupIntervalMs: 60000,
};

export class AgenticLoop {
	private readonly config: Required<AgenticLoopConfig>;
	private readonly queue: MessageQueue;
	private readonly episodicMemory?: EpisodicMemory;
	private running = false;
	private idleCounter = 0;
	private nextWakeAt = 0;
	private currentTurn = 0;
	private onMessage?: (msg: IOMessage) => Promise<void>;

	constructor(
		config: AgenticLoopConfig = DEFAULT_CONFIG,
		episodicMemory?: EpisodicMemory
	) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.queue = new MessageQueue();
		this.episodicMemory = episodicMemory;
	}

	setMessageHandler(handler: (msg: IOMessage) => Promise<void>): void {
		this.onMessage = handler;
	}

	start(): void {
		if (this.running) return;
		this.running = true;
		this.nextWakeAt = Date.now() + this.config.wakeupIntervalMs;
		this.runLoop();
	}

	stop(): void {
		this.running = false;
	}

	pushMessage(message: IOMessage): void {
		this.queue.push(message);
	}

	private async runLoop(): Promise<void> {
		while (this.running) {
			const messages = this.queue.drain();
			
			if (messages.length > 0) {
				this.idleCounter = 0;
				await this.processMessages(messages);
			} else {
				this.idleCounter++;
			}

			const now = Date.now();
			if (this.idleCounter >= this.config.maxInputTurns && now >= this.nextWakeAt) {
				await this.wakeupSequence();
				this.nextWakeAt = now + this.config.wakeupIntervalMs;
				this.idleCounter = 0;
			}

			await this.sleep(this.config.sleepIntervalMs);
			this.currentTurn++;
		}
	}

	private async processMessages(messages: IOMessage[]): Promise<void> {
		for (const message of messages) {
			if (this.onMessage) {
				await this.onMessage(message);
			}
			
			if (this.episodicMemory) {
				await this.episodicMemory.log('input', message.text, {
					channel: message.source,
					user: message.sender,
				});
			}
		}
	}

	private async wakeupSequence(): Promise<void> {
		// Placeholder for self-initiated work during wake cycles
	}

	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	getStats(): { turn: number; idleCounter: number; queueSize: number } {
		return {
			turn: this.currentTurn,
			idleCounter: this.idleCounter,
			queueSize: this.queue.size(),
		};
	}
}
