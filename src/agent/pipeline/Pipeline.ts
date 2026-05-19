import type {BotContext, BotResponse, StreamChunk} from '../BotContext.js';
import type {IOMessage} from '../BotContext.js';

export interface PipelineStage {
  name: string;
  priority: number;
  enabled: (ctx: BotContext) => boolean;
  execute(ctx: BotContext): Promise<void>;
}

export class MessagePipeline {
  private stages: PipelineStage[];
  private loopStages = new Set(['SeNARSProcessor', 'LMResponder', 'DirectiveProcessor', 'ResponseComposer']);

  constructor(stages: PipelineStage[]) {
    this.stages = stages.sort((a, b) => a.priority - b.priority);
  }

  async process(message: IOMessage, ctx: BotContext): Promise<BotResponse> {
    ctx.turn.input = message;
    ctx.turn.passCount = 0;
    ctx.turn.needsLoopBack = false;
    ctx.metrics = { startTime: Date.now(), stages: new Map() };

    const loopBackOn = new Set<string>(ctx.config.pipeline?.loopBackOn ?? ['believe', 'question']);
    const enableLoopBack = ctx.config.pipeline?.enableLoopBack !== false;
    const maxLoops = ctx.config.pipeline?.maxLoops ?? 2;

    do {
      ctx.turn.passCount++;
      ctx.turn.needsLoopBack = false;
      ctx.events.emit('turn:start', { input: message, passCount: ctx.turn.passCount });
      
      if (ctx.turn.passCount > 1) {
        ctx.events.emit('loop:pass', { passCount: ctx.turn.passCount, needsLoopBack: ctx.turn.needsLoopBack });
      }

      for (const stage of this.stages) {
        if (!stage.enabled(ctx)) continue;
        if (ctx.turn.passCount > 1 && !this.loopStages.has(stage.name)) continue;

        ctx.events.emit('stage:start', { stage: stage.name, passCount: ctx.turn.passCount });
        const start = Date.now();
        
        try {
          await Promise.race([
            stage.execute(ctx),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Stage ${stage.name} timed out`)), ctx.config.pipeline?.stageTimeoutMs ?? 30000)
            ),
          ]);
          
          ctx.events.emit('stage:end', { stage: stage.name, durationMs: Date.now() - start, passCount: ctx.turn.passCount });
        } catch (error) {
          ctx.turn.error = error as Error;
          ctx.events.emit('stage:error', { stage: stage.name, error: error as Error, durationMs: Date.now() - start });
          ctx.events.emit('turn:error', { error: error as Error, stage: stage.name, passCount: ctx.turn.passCount });
          ctx.metrics.stages.set(stage.name, { durationMs: Date.now() - start, error: String(error) });
          ctx.turn.finalResponse = this.errorResponse(error, ctx);
          break;
        }
        
        ctx.metrics.stages.set(stage.name, { durationMs: Date.now() - start });

        if (ctx.turn.finalResponse && stage.name === 'CommandProcessor') {
          ctx.events.emit('turn:end', { response: this.composeResponse(ctx), durationMs: Date.now() - ctx.metrics.startTime });
          return this.composeResponse(ctx);
        }
      }

      if (ctx.turn.error) break;
    } while (
      enableLoopBack &&
      ctx.turn.needsLoopBack &&
      loopBackOn.has(ctx.turn.loopBackType ?? '') &&
      ctx.turn.passCount < maxLoops
    );

    ctx.events.emit('turn:end', { response: this.composeResponse(ctx), durationMs: Date.now() - ctx.metrics.startTime });
    return this.composeResponse(ctx);
  }

  private composeResponse(ctx: BotContext): BotResponse {
    return {
      text: ctx.turn.finalResponse,
      reasoning: ctx.turn.reasoningResult,
      actions: ctx.turn.actions,
      metrics: ctx.metrics,
    };
  }

  private errorResponse(error: unknown, ctx: BotContext): string {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('LM') || (msg.includes('timeout') && ctx.capabilities.hasSeNARS)) {
      return 'LM is currently unavailable. I can still process Narsese input and commands.';
    }
    if (msg.includes('SeNARS') || msg.includes('NAR')) {
      return 'Reasoning engine is unavailable. Chat mode is still active.';
    }
    return `An error occurred: ${msg}`;
  }

  getStages(): PipelineStage[] {
    return [...this.stages];
  }
}
