import type {BotContext, Message} from '../../BotContext.js';
import type {PipelineStage} from '../Pipeline.js';
import {LMStreamAdapter, ChannelStreamer} from '../../streaming/index.js';

export class LMResponder implements PipelineStage {
  name = 'LMResponder';
  priority = 7;
  enabled = (ctx: BotContext) => ctx.capabilities.hasLM;

  async execute(ctx: BotContext): Promise<void> {
    const lm = ctx.lm;
    if (!lm) return;

    const messages = this.buildMessages(ctx);

    if (ctx.config.streaming.enabled && lm.provider) {
      await this.streamResponse(ctx, lm, messages);
    } else {
      ctx.turn.lmResponse = await lm.generateText(
        messages.map(m => `${m.role}: ${m.content}`).join('\n')
      );
    }

    const cleaned = this.cleanResponse(ctx.turn.lmResponse || '');
    ctx.turn.lmResponse = cleaned;

    if (ctx.turn.lmResponse && /\[REASONING_SUGGESTED:/.test(cleaned)) {
      ctx.turn.lmSuggestsReasoning = true;
    }
  }

  private async streamResponse(ctx: BotContext, lm: NonNullable<BotContext['lm']>, messages: Message[]): Promise<void> {
    const adapter = new LMStreamAdapter(lm as any);
    const streamer = new ChannelStreamer();
    
    // Send typing indicator
    await ctx.connection.respond({ type: 'status', content: 'typing', done: false });

    // Stream response using adapter
    let fullResponse = '';
    try {
      for await (const chunk of adapter.stream(messages)) {
        if (chunk.type === 'text' && chunk.content) {
          fullResponse += chunk.content;
          await ctx.connection.respond(chunk);
        } else if (chunk.type === 'error') {
          await ctx.connection.respond({ type: 'error', content: chunk.content, done: true });
          break;
        }
      }
    } catch (error) {
      await ctx.connection.respond({ 
        type: 'error', 
        content: `Stream interrupted: ${error instanceof Error ? error.message : String(error)}`, 
        done: true 
      });
      fullResponse = this.generateFallbackResponse(ctx);
    }

    ctx.turn.lmResponse = fullResponse;
  }

  private generateFallbackResponse(ctx: BotContext): string {
    return ctx.capabilities.hasLM 
      ? "I'm having trouble generating a response right now." 
      : "Processed.";
  }

    private cleanResponse(response: string): string {
        return response
            .replace(/\[REASONING_SUGGESTED:[^\]]*\]\s*/g, '')
            .trim();
    }

    private buildMessages(ctx: BotContext): Message[] {
        const system = this.buildSystemPrompt(ctx);
        const history = ctx.conversation.getHistory(ctx.config.conversation.maxHistory);

        return [
            { role: 'system', content: system, timestamp: Date.now() },
            ...history.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp })),
            { role: 'user', content: ctx.turn.input.text, timestamp: Date.now() },
        ];
    }

    private buildSystemPrompt(ctx: BotContext): string {
        const parts: string[] = [];

        parts.push(`You are ${ctx.profile.name}. ${ctx.profile.personality}`);

        if (ctx.capabilities.hasSeNARS && ctx.seNARS) {
            const attention = ctx.seNARS.attentionReport();
            if (attention.concepts.length > 0) {
                parts.push('\n## Knowledge Context');
                for (const c of attention.concepts.slice(0, 10)) {
                    parts.push(`- ${c.term} (priority: ${(c.priority * 100).toFixed(0)}%)`);
                }
            }
        }

        parts.push('\n## Response Guidelines');
        parts.push('- Be concise and direct');
        parts.push('- When uncertain, acknowledge uncertainty');

        return parts.join('\n');
    }
}