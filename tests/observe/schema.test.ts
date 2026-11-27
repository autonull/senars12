import { describe, it, expect } from 'vitest';
import {
  createFindingSignature,
  createCheckId,
  generateId,
  FindingKindSchema,
  FindingSeveritySchema,
  CheckKindSchema,
} from '../../observe/src/schema.js';

describe('observe schema', () => {
  it('creates finding signatures', () => {
    const sig1 = createFindingSignature('wrong-output', 'expectation_1');
    expect(sig1).toBe('wrong-output:expectation_1');

    const sig2 = createFindingSignature('loop', undefined, 'mark_1');
    expect(sig2).toBe('loop:mark_1');

    const sig3 = createFindingSignature('stalled');
    expect(sig3).toBe('stalled:unknown');
  });

  it('creates check IDs', () => {
    const checkId = createCheckId('validator', 'contradiction_detected_within');
    expect(checkId).toBe('validator:contradiction_detected_within');
  });

  it('generates unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThan(0);
  });

  it('has correct FindingKind enum values', () => {
    expect(FindingKindSchema.options).toContain('wrong-output');
    expect(FindingKindSchema.options).toContain('loop');
    expect(FindingKindSchema.options).toContain('stalled');
    expect(FindingKindSchema.options).toContain('broken-ui');
    expect(FindingKindSchema.options).toContain('narration-divergence');
    expect(FindingKindSchema.options).toContain('unmet-expectation');
  });

  it('has correct FindingSeverity enum values', () => {
    expect(FindingSeveritySchema.options).toContain('info');
    expect(FindingSeveritySchema.options).toContain('warn');
    expect(FindingSeveritySchema.options).toContain('fail');
    expect(FindingSeveritySchema.options).toContain('uncertain');
  });

  it('has correct CheckKind enum values', () => {
    expect(CheckKindSchema.options).toContain('validator');
    expect(CheckKindSchema.options).toContain('literal');
    expect(CheckKindSchema.options).toContain('stall');
    expect(CheckKindSchema.options).toContain('ui');
    expect(CheckKindSchema.options).toContain('budget');
  });
});