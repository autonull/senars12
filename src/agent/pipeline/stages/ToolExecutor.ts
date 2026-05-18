import type {BotContext} from '../../BotContext.js';
import type {PipelineStage} from '../Pipeline.js';
import type {ToolResult as NARToolResult} from '../../../nar/tools/types.js';

interface ToolDirective {
    name: string;
    args: string;
}

export class ToolExecutor implements PipelineStage {
    name = 'ToolExecutor';
    priority = 8;
    enabled = (ctx: BotContext) => ctx.capabilities.hasTools &&
        !!ctx.turn.lmResponse && /\[TOOL:/.test(ctx.turn.lmResponse);

    async execute(ctx: BotContext): Promise<void> {
        const nar = ctx.seNARS;
        if (!nar) return;

        const directives = extractToolDirectives(ctx.turn.lmResponse!);

        for (const directive of directives) {
            const tool = nar.tools.get(directive.name);
            if (!tool) {
                ctx.turn.toolResults.push({ name: directive.name, error: 'Tool not found' });
                continue;
            }
            try {
                const args = directive.args ? JSON.parse(`{${directive.args}}`) : {};
                const result: NARToolResult = await nar.executeTool(directive.name, args);
                ctx.turn.toolResults.push({ name: directive.name, result: result.content });

                if (result.content && typeof result.content === 'object' && 'narsese' in result.content) {
                    await nar.believe((result.content as { narsese: string }).narsese);
                    await nar.run(3);
                }
            } catch (error) {
                ctx.turn.toolResults.push({ name: directive.name, error: String(error) });
            }
        }

        ctx.turn.lmResponse = ctx.turn.lmResponse!.replace(/\[TOOL:[^\]]*\]\s*/g, '').trim();
    }
}

function extractToolDirectives(response: string): ToolDirective[] {
    const pattern = /\[TOOL:\s*(\w+)\s*\(([^)]*)\)\]/gi;
    const results: ToolDirective[] = [];
    for (const match of response.matchAll(pattern)) {
        results.push({ name: match[1]!, args: match[2]! });
    }
    return results;
}