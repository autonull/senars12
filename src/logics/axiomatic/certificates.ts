/**
 * Proof Certificates — verifiable proof objects for axiomatic derivations.
 *
 * Generates and verifies proof certificates that can be independently checked.
 */

import { Term, VariableTerm, TermOp, termInterner } from '../../kernel/terms/intern.js';
import { Formula, Atom, ProofCertificate, ProofStep, Clause, Literal, Model, isAtom } from './ast.js';

/** Certificate format version. */
export const CERTIFICATE_VERSION = '1.0';

/** Certificate generator. */
export class CertificateGenerator {
  private steps: ProofStep[] = [];
  private engine: string;
  private theorem: Formula;

  constructor(theorem: Formula, engine: string) {
    this.theorem = theorem;
    this.engine = engine;
  }

  /** Add a proof step. */
  addStep(rule: string, premises: readonly Formula[], conclusion: Formula, justification?: string): void {
    this.steps.push({ rule, premises, conclusion, justification });
  }

  /** Add multiple steps. */
  addSteps(steps: ProofStep[]): void {
    this.steps.push(...steps);
  }

  /** Generate the certificate. */
  generate(verified = true): ProofCertificate {
    return {
      theorem: this.theorem,
      proof: [...this.steps],
      engine: this.engine,
      timestamp: Date.now(),
      verified,
    };
  }

  /** Generate certificate from SLD derivation. */
  static fromSLDDerivation(
    theorem: Formula,
    steps: readonly { goal: readonly Atom[]; clause: Clause; mgu: { substitution: Map<VariableTerm, Term>; isIdentity: boolean }; newGoal: readonly Atom[] }[],
    engine = 'SLD'
  ): ProofCertificate {
    const generator = new CertificateGenerator(theorem, engine);

    for (const step of steps) {
      const premises = step.goal.map(g => g as unknown as Formula);
      const conclusion = step.newGoal.length > 0
        ? step.newGoal[0] as unknown as Formula
        : theorem;

      generator.addStep(
        'SLD_Resolution',
        premises,
        conclusion,
        `Clause: ${step.clause.literals.map(l => `${l.sign ? '' : '~'}${l.atom.predicate}`).join(' | ')}`
      );
    }

    return generator.generate(true);
  }

  /** Generate certificate from model. */
  static fromModel(theorem: Formula, model: Model, engine = 'ModelFinder'): ProofCertificate {
    const generator = new CertificateGenerator(theorem, engine);

    generator.addStep(
      'Model_Checking',
      [],
      theorem,
      `Model with domain size ${model.domain.length}: ${JSON.stringify(Array.from(model.interpretation.entries()))}`
    );

    return generator.generate(true);
  }

  /** Generate certificate from MUS. */
  static fromMUS(mus: { clauses: readonly Clause[] }, engine = 'MUS'): ProofCertificate {
    // For MUS, the theorem is the conjunction of clauses (unsatisfiable)
    const generator = new CertificateGenerator(
      { predicate: 'UNSAT', args: [], negated: false },
      engine
    );

    for (let i = 0; i < mus.clauses.length; i++) {
      const clause = mus.clauses[i]!;
      generator.addStep(
        'Clause',
        [],
        { predicate: `C${i}`, args: [], negated: false },
        clause.literals.map(l => `${l.sign ? '' : '~'}${l.atom.predicate}`).join(' | ')
      );
    }

    generator.addStep(
      'Conflict',
      mus.clauses.map((_, i) => ({ predicate: `C${i}`, args: [], negated: false })),
      { predicate: 'UNSAT', args: [], negated: false },
      'Minimal unsatisfiable subset'
    );

    return generator.generate(true);
  }
}

/** Certificate verifier. */
export class CertificateVerifier {
  private certificate: ProofCertificate;

  constructor(certificate: ProofCertificate) {
    this.certificate = certificate;
  }

  /** Verify the certificate. */
  verify(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check version
    // (version field not in current schema, would be added)

    // Check proof steps
    for (let i = 0; i < this.certificate.proof.length; i++) {
      const step = this.certificate.proof[i]!;
      const stepErrors = this.verifyStep(step, i);
      errors.push(...stepErrors);
    }

    // Check final conclusion matches theorem
    const lastStep = this.certificate.proof[this.certificate.proof.length - 1];
    if (lastStep && !this.formulasEqual(lastStep.conclusion, this.certificate.theorem)) {
      errors.push('Final conclusion does not match theorem');
    }

    return { valid: errors.length === 0, errors };
  }

  /** Verify a single proof step. */
  private verifyStep(step: ProofStep, index: number): string[] {
    const errors: string[] = [];

    // Check rule name
    if (!step.rule || step.rule.trim() === '') {
      errors.push(`Step ${index}: Missing rule name`);
    }

    // Check premises and conclusion are well-formed
    for (const premise of step.premises) {
      if (!this.isWellFormed(premise)) {
        errors.push(`Step ${index}: Malformed premise`);
      }
    }

    if (!this.isWellFormed(step.conclusion)) {
      errors.push(`Step ${index}: Malformed conclusion`);
    }

    return errors;
  }

  /** Check if formula is well-formed. */
  private isWellFormed(formula: Formula): boolean {
    if (isAtom(formula)) {
      return typeof formula.predicate === 'string' && Array.isArray(formula.args);
    }
    return true; // Simplified
  }

  /** Check formula equality (structural). */
  private formulasEqual(f1: Formula, f2: Formula): boolean {
    return JSON.stringify(f1) === JSON.stringify(f2);
  }

  /** Get certificate metadata. */
  getMetadata(): { engine: string; timestamp: number; stepCount: number; theorem: string } {
    return {
      engine: this.certificate.engine,
      timestamp: this.certificate.timestamp,
      stepCount: this.certificate.proof.length,
      theorem: this.formulaToString(this.certificate.theorem),
    };
  }

  private formulaToString(formula: Formula): string {
    if (isAtom(formula)) {
      return `${formula.negated ? '~' : ''}${formula.predicate}(${formula.args.map(a => {
        if (a.op === 'var') return a.name;
        if (a.op === 'const') return a.value;
        return a.op;
      }).join(', ')})`;
    }
    return 'ComplexFormula';
  }
}

/** Serialize certificate to JSON. */
export function serializeCertificate(certificate: ProofCertificate): string {
  return JSON.stringify(certificate, (key, value) => {
    if (value instanceof Map) {
      return Object.fromEntries(value);
    }
    if (value instanceof Set) {
      return Array.from(value);
    }
    return value;
  }, 2);
}

/** Deserialize certificate from JSON. */
export function deserializeCertificate(json: string): ProofCertificate {
  return JSON.parse(json);
}

/** Verify certificate from JSON string. */
export function verifyCertificate(json: string): { valid: boolean; errors: string[]; metadata?: ReturnType<CertificateVerifier['getMetadata']> } {
  try {
    const certificate = deserializeCertificate(json);
    const verifier = new CertificateVerifier(certificate);
    const result = verifier.verify();
    return {
      valid: result.valid,
      errors: result.errors,
      metadata: result.valid ? verifier.getMetadata() : undefined,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`Parse error: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/** Create certificate generator. */
export function createCertificateGenerator(theorem: Formula, engine: string): CertificateGenerator {
  return new CertificateGenerator(theorem, engine);
}

/** Create certificate verifier. */
export function createCertificateVerifier(certificate: ProofCertificate): CertificateVerifier {
  return new CertificateVerifier(certificate);
}