/**
 * Perception Faculty Specs — grounding and formalization.
 */

import type { FacultySpec } from '../../specs';
import { createFallback } from './utils';

/** 1. Grounding Faculty - connects symbols to referents */
export const groundingSpec: FacultySpec = {
  name: 'grounding',
  description: 'Grounds symbols in concrete referents through perception or retrieval',
  category: 'perception',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      secondary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          confidenceThreshold: { type: 'number' },
          maxResults: { type: 'number' },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      groundings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            term: { type: 'object' },
            referent: { type: 'string' },
            confidence: { type: 'number' },
          },
        },
      },
    },
  },
  oracleOperation: 'retrieval.query',
  fallback: createFallback('grounding', { groundings: [] }, 0.1, 'No grounding available', 0.1),
  enabled: true,
  priority: 0.9,
  budgetCost: 0.1,
  maxConcurrency: 10,
  timeoutMs: 5000,
};

/** Perceive-Formalize Faculty - converts raw perception to formal terms */
export const perceiveFormalizeSpec: FacultySpec = {
  name: 'perceive.formalize',
  description: 'Converts raw perceptual input into structured formal terms',
  category: 'perception',
  inputSchema: {
    type: 'object',
    properties: {
      primary: { type: 'object' },
      context: {
        type: 'object',
        properties: {
          modality: { type: 'string' },
          confidenceThreshold: { type: 'number' },
        },
      },
    },
    required: ['primary'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      terms: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            term: { type: 'object' },
            truth: { type: 'object' },
            source: { type: 'string' },
          },
        },
      },
    },
  },
  oracleOperation: 'lm.generateObject',
  fallback: createFallback('perceive.formalize', { terms: [] }, 0.2, 'Formalization fallback', 0.2),
  enabled: true,
  priority: 0.85,
  budgetCost: 0.15,
  maxConcurrency: 5,
  timeoutMs: 8000,
};