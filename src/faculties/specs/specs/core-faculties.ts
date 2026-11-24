/**
 * Core Faculty Specifications — the 25 core faculty definitions.
 *
 * This file collects all faculty specs into a single array for registration.
 */

import type { FacultySpec } from '../../specs';
import { groundingSpec, perceiveFormalizeSpec } from './perception';
import { inferenceSpec, abductionSpec, analogySpec, revisionSpec, evaluationSpec, proposeHypothesisSpec, judgeRubricSpec } from './judgment';
import { planningSpec, proposeActionSpec, proposePlanSpec, simulateScenarioSpec } from './action';
import { communicationSpec, governanceSpec, proposeRepairSpec, proposeSkillSpec, inductionSpec, narrateExplainSpec, mirrorPostmortemSpec, retrieveRerankSpec } from './metacognition';

/** The 25 core faculty specifications, in registration order. */
export const CORE_FACULTIES: FacultySpec[] = [
  // Perception (2)
  groundingSpec,
  perceiveFormalizeSpec,
  // Reasoning (7)
  inferenceSpec,
  abductionSpec,
  inductionSpec,
  analogySpec,
  revisionSpec,
  evaluationSpec,
  judgeRubricSpec,
  // Action (5)
  planningSpec,
  proposeActionSpec,
  proposePlanSpec,
  simulateScenarioSpec,
  communicationSpec,
  // Meta/LM Roles (7)
  proposeHypothesisSpec,
  proposeRepairSpec,
  proposeSkillSpec,
  governanceSpec,
  narrateExplainSpec,
  mirrorPostmortemSpec,
  retrieveRerankSpec,
];

/** Faculty names for quick lookup. */
export const FACULTY_NAMES = CORE_FACULTIES.map(s => s.name);