import type {PipelineStage} from './Pipeline.js';
import {InputNormalizer} from './stages/InputNormalizer.js';
import {AuthChecker} from './stages/AuthChecker.js';
import {CommandProcessor} from './stages/CommandProcessor.js';
import {NLAnalyzerStage} from './stages/NLAnalyzerStage.js';
import {ReasoningTriggerStage} from './stages/ReasoningTrigger.js';
import {SeNARSProcessor} from './stages/SeNARSProcessor.js';
import {LMResponder} from './stages/LMResponder.js';
import {DirectiveProcessor} from './stages/DirectiveProcessor.js';
import {ResponseComposer} from './stages/ResponseComposer.js';
import {ResponseFormatter} from './stages/ResponseFormatter.js';
import {StatePersistor} from './stages/StatePersistor.js';
import type {CommandRegistry} from '../../io/commands/registry.js';
import type {EpisodicMemory} from '../../nar/memory/EpisodicMemory.js';

type StageDeps = { commands: CommandRegistry; episodicMemory?: EpisodicMemory };
export type StageFactory = (deps: StageDeps) => PipelineStage;

export const PRESETS: Record<string, StageFactory[]> = {
  default: [
    () => new InputNormalizer(),
    () => new AuthChecker(),
    (d) => new CommandProcessor(d.commands),
    () => new NLAnalyzerStage(),
    () => new ReasoningTriggerStage(),
    () => new SeNARSProcessor(),
    () => new LMResponder(),
    () => new DirectiveProcessor(),
    () => new ResponseComposer(),
    () => new ResponseFormatter(),
    (d) => new StatePersistor(d.episodicMemory),
  ],
  chat: [
    () => new InputNormalizer(),
    () => new AuthChecker(),
    (d) => new CommandProcessor(d.commands),
    () => new NLAnalyzerStage(),
    () => new LMResponder(),
    () => new ResponseComposer(),
    () => new ResponseFormatter(),
    (d) => new StatePersistor(d.episodicMemory),
  ],
  reasoning: [
    () => new InputNormalizer(),
    () => new AuthChecker(),
    (d) => new CommandProcessor(d.commands),
    () => new NLAnalyzerStage(),
    () => new ReasoningTriggerStage(),
    () => new SeNARSProcessor(),
    () => new ResponseComposer(),
    () => new ResponseFormatter(),
    (d) => new StatePersistor(d.episodicMemory),
  ],
  tool: [
    () => new InputNormalizer(),
    () => new AuthChecker(),
    (d) => new CommandProcessor(d.commands),
    () => new NLAnalyzerStage(),
    () => new SeNARSProcessor(),
    () => new LMResponder(),
    () => new DirectiveProcessor(),
    () => new ResponseComposer(),
    () => new ResponseFormatter(),
    (d) => new StatePersistor(d.episodicMemory),
  ],
};
