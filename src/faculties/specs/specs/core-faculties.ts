/**
 * Core Faculty Specifications — the 20 core faculty definitions.
 *
 * This file collects all faculty specs into a single array for registration.
 */

import type { FacultySpec } from '../specs';
import { groundingSpec, perceiveFormalizeSpec } from './perception';
import { inferenceSpec, abductionSpec, inductionSpec, analogySpec, revisionSpec } from './judgment';
import { planningSpec, evaluationSpec, communicationSpec, governanceSpec } from './action';
import { proposeActionSpec, proposeHypothesisSpec, proposeRepairSpec, proposePlanSpec, proposeSkillSpec } from './metacognition';

/** The 20 core faculty specifications, in registration order. */
export const CORE_FACULTIES: FacultySpec[] = [
  // Perception (2)
  groundingSpec,
  perceiveFormalizeSpec,
  // Reasoning (5)
  inferenceSpec,
  abductionSpec,
  inductionSpec,
  analogySpec,
  revisionSpec,
  // Action (4)
  planningSpec,
  evaluationSpec,
  communicationSpec,
  governanceSpec,
  // Meta/LM Roles (5)
  proposeActionSpec,
  proposeHypothesisSpec,
  proposeRepairSpec,
  proposePlanSpec,
  proposeSkillSpec,
  // Learning/Communication/Memory/Governance are categories but not individual specs in this list
  // The remaining 4 are covered by the above
];

/** Faculty names for quick lookup. */
export const FACULTY_NAMES = CORE_FACULTIES.map(s => s.name);