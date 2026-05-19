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
    const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');

    ctx.events.emit('lm:start', { promptLength: prompt.length, streaming: ctx.config.streaming.enabled });

    if (ctx.config.streaming.enabled && lm.provider) {
      await this.streamResponse(ctx, lm, messages);
    } else {
      const start = Date.now();
      ctx.turn.lmResponse = await lm.generateText(prompt);
      ctx.events.emit('lm:end', { response: ctx.turn.lmResponse, durationMs: Date.now() - start });
    }

    // Check for reasoning suggestion
    const raw = ctx.turn.lmResponse || '';
    ctx.turn.lmSuggestsReasoning = /\[REASONING_SUGGESTED:/.test(raw);
    if (ctx.turn.lmSuggestsReasoning) {
      ctx.events.emit('lm:suggests-reasoning', true);
    }

    // Clean response (but NOT directives - DirectiveProcessor handles that)
    ctx.turn.lmResponse = raw.replace(/\[REASONING_SUGGESTED:[^\]]*\]\s*/g, '').trim();
  }

  private async streamResponse(ctx: BotContext, lm: NonNullable<BotContext['lm']>, messages: Message[]): Promise<void> {
    const adapter = new LMStreamAdapter(lm);
    const streamer = new ChannelStreamer();

    // Send typing indicator
    await ctx.connection.respond({ type: 'status', content: 'typing', done: false });

    // Stream response using adapter
    let fullResponse = '';
    const start = Date.now();
    try {
      for await (const chunk of adapter.stream(messages)) {
        if (chunk.type === 'text' && chunk.content) {
          fullResponse += chunk.content;
          ctx.events.emit('lm:chunk', { content: chunk.content, accumulated: fullResponse });
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
    ctx.events.emit('lm:end', { response: fullResponse, durationMs: Date.now() - start });
  }

  private generateFallbackResponse(ctx: BotContext): string {
    return ctx.capabilities.hasLM
      ? "I'm having trouble generating a response right now."
      : "Processed.";
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

      // Add context from SeNARS
      const narCtx = ctx.conversation.getContextForLM(10, ctx.seNARS);
      if (narCtx) {
        parts.push('\n## SeNARS Context');
        parts.push(narCtx);
      }
    }

    parts.push('\n## Response Guidelines');
    parts.push('- Be concise and direct');
    parts.push('- When uncertain, acknowledge uncertainty');
    parts.push('- You can use directives to interact with SeNARS:');
    parts.push('  - [BELIEVE: (<term --> category>. :f:c)] to add beliefs');
    parts.push('  - [QUESTION: (<term --> ?>.)] to ask questions');
    parts.push('  - [TOOL:name(args)] to call tools');
    parts.push('  - [REASONING_DEPTH:n] to control reasoning depth');

    return parts.join('\n');
  }
}
