/**
 * Kernel Types — shared type definitions and utilities.
 * 
 * Compatibility layer for generated schemas:
 * - Generated schemas use `frequency`/`confidence` 
 * - Internal code uses `f`/`c` for brevity
 * This module provides both interfaces.
 */

import type { Term } from './terms/term.js';

/** Timestamp in milliseconds since epoch. */
export type TimestampMs = number;

/** Frequency in [0, 1]. */
export type Frequency = number;

/** Confidence in [0, 1]. */
export type Confidence = number;

/** Truth-like input for normalization (matches generated schema). */
export interface TruthLike {
  frequency: number;
  confidence: number;
}

/** Truth value (internal representation with short properties). */
export interface TruthValue {
  readonly f: Frequency;
  readonly c: Confidence;
}

/** Truth value (generated schema representation). */
export interface TruthValueSchema {
  readonly frequency: Frequency;
  readonly confidence: Confidence;
}

/** Convert internal TruthValue to schema TruthValue. */
export function toSchemaTruth(t: TruthValue): TruthValueSchema {
  return { frequency: t.f, confidence: t.c };
}

/** Convert schema TruthValue to internal TruthValue. */
export function fromSchemaTruth(t: TruthValueSchema): TruthValue {
  return { f: t.frequency, c: t.confidence };
}

/** UUID type (matches generated schema uuid() output). */
export type UUID = string;

/** Stamp for temporal/causal tracking. */
export interface Stamp {
  readonly id: UUID;
  readonly ts: TimestampMs;
  readonly parents: readonly UUID[];
  readonly derivation: readonly string[];
  readonly evidence: number;
}

/** Clamp a number to a range. */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Clamp to [0, 1]. */
export function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

/** Safe division with zero check. */
export function safeDiv(n: number, d: number): number {
  return d === 0 ? 0 : n / d;
}

/** Soft squash function for confidence weakening. */
export function softSquash(c: number, factor = 10): number {
  return c / (1 + c * factor);
}

/** Weaken confidence by factor. */
export function weakenConfidence(c: number, factor: number): number {
  return c / (c + factor);
}

/** Convert confidence to weight (evidence count). */
export function confidenceToWeight(c: number): number {
  return c === 1 ? Infinity : c / (1 - c);
}

/** Convert weight to confidence. */
export function weightToConfidence(w: number): number {
  return w === Infinity ? 1 : w / (1 + w);
}

/** Parse truth literal from string. */
export function parseTruthLiteral(s: string): { f: number; c: number } | null {
  const match = /%([\d.]+);([\d.]+)%/.exec(s);
  if (!match) return null;
  return { f: parseFloat(match[1]!), c: parseFloat(match[2]!) };
}

/** Format truth as string (internal format). */
export function formatTruth(t: TruthValue, digits = 2): string {
  return `%${t.f.toFixed(digits)};${t.c.toFixed(digits)}%`;
}

/** Format truth as string (schema format). */
export function formatSchemaTruth(t: TruthValueSchema, digits = 2): string {
  return `%${t.frequency.toFixed(digits)};${t.confidence.toFixed(digits)}%`;
}

/** Serialize truth. */
export function serializeTruth(t: TruthValue): string {
  return formatTruth(t);
}

/** Nearly equal comparison. */
export function nearlyEqual(a: number, b: number, epsilon = 1e-3): boolean {
  return Math.abs(a - b) < epsilon;
}

/** Task type enumeration. */
export enum TaskType {
  BELIEF = 'belief',
  GOAL = 'goal',
  QUESTION = 'question',
}

/** Task punctuation. */
export enum TaskPunctuation {
  STATEMENT = '.',
  QUESTION = '?',
  GOAL = '!',
}

/** Task bag kind. */
export enum TaskBagKind {
  DERIVATION = 'derivation',
  INPUT = 'input',
  OUTPUT = 'output',
}

/** Task representation. */
export interface Task {
  readonly term: Term;
  readonly type: TaskType;
  readonly truth: TruthValue;
  readonly priority: number;
  readonly stamp?: Stamp;
}

/** Create a task. */
export function createTask(
  term: Term,
  type: TaskType,
  truth: TruthValue,
  priority: number,
  stamp?: Stamp
): Task {
  return { term, type, truth, priority, stamp };
}