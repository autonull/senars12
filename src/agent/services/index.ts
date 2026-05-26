export {NarService} from './NarService.js';
export type {ConceptFilter, PaginationParams} from './NarService.js';

export {ObserverService} from './ObserverService.js';
export type {CognitiveState, CognitiveAction, ObserverReport} from './ObserverService.js';

export {SelfAnalysisService} from './SelfAnalysisService.js';
export type {SelfAnalysisConfig, SelfAnalysisState, AnalysisReport} from './SelfAnalysisService.js';

export {SelfAnalyzerService} from './SelfAnalyzerService.js';
export type {
  SelfAnalyzerConfig,
  InferenceChain,
  TermPattern,
  PatternAnalysis,
  MonitorState,
  ReasoningStep,
  MetaCognitiveResult,
  IdentifiedIssues,
  CorrectionResult,
  CapabilitySnapshot,
  CapabilityDiff,
} from './SelfAnalyzerService.js';

export {MetacognitiveMonitor} from './MetacognitiveMonitor.js';
export type {MetacognitiveMonitorConfig, ReasoningStep as MetacognitiveReasoningStep} from './MetacognitiveMonitor.js';

export {CognitiveController} from './CognitiveController.js';
export type {CognitiveControllerConfig} from './CognitiveController.js';
