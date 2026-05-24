/**
 * Agent API stubs for backward compatibility
 * MCP registration functions - no-op until fully implemented
 */

import type {ScenarioRunner} from '../agent/scenarios/ScenarioRunner.js';
import type {ExperimentRunner} from '../agent/experiments/ExperimentRunner.js';
import type {RegressionTracker} from '../agent/scenarios/RegressionTracker.js';
import type {EnhancedMCPAdapter} from './mcp/enhanced-adapter.js';

export function registerAgentAPI(_agent: unknown, _adapter: EnhancedMCPAdapter): void {
}

export function registerScenarioAPIs(_runner: ScenarioRunner, _adapter?: EnhancedMCPAdapter): void {
}

export function registerExperimentAPIs(_runner: ExperimentRunner, _adapter?: EnhancedMCPAdapter): void {
}

export function registerSelfAnalysisAPIs(_analyzer: unknown, _adapter?: EnhancedMCPAdapter): void {
}

export function registerRegressionAPIs(_tracker: RegressionTracker, _adapter?: EnhancedMCPAdapter): void {
}