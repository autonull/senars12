export {QueryAPI, createQueryAPI} from './api.js';
export type {QueryResult, Answer} from './api.js';
export type {TermFilter} from '../types/index.js';

export {ReasoningTrace, createReasoningTrace} from './trace.js';
export type {DerivationTree, DerivationNode, TraceResult, ExplainResult} from './trace.js';

export {MetricsCollector, createMetricsCollector} from '../metrics/index.js';
export type {RuleStats, MemoryStats, LMStats, ThroughputStats, SystemMetrics} from '../metrics/index.js';

export {Logger, createLogger, LoggerFactory, defaultLogger} from '../logger/index.js';
export type {LogLevel, LogEntry, LoggerConfig} from '../logger/index.js';
