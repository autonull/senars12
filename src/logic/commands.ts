/**
 * Logic commands — `prove`, `model`, `counterexample`, `check`, `convert`.
 *
 * The commands run on the deterministic axiomatic core: SLD resolution for
 * proofs, finite model finding for countermodels, and the certificate verifier
 * for re-checking. `prove` returns a certificate that `check` accepts without
 * the prover: verification is independent of the derivation that made it.
 */

import type { Formula, ProofCertificate } from '../logics/axiomatic/ast';
import { not } from '../logics/axiomatic/ast';
import { CertificateGenerator, CertificateVerifier, verifyCertificate } from '../logics/axiomatic/certificates';
import { createModelFinder } from '../logics/axiomatic/models';
import { createSLDResolver } from '../logics/axiomatic/sld';
import { decodeNarsese, encodeNarsese, serializeTerm, deserializeTerm } from '../kernel/terms/codec/narsese';
import { TermOp } from '../kernel/terms';
import { parseAtom, parseProgram } from './parse';
import { proved, refuted, unknown, type CommandResult, type Verdict } from './verdict';

/** Prove `goal` from `program` by SLD resolution; return a re-checkable certificate. */
export const prove = (program: string, goal: string, options: { maxDepth?: number; maxSolutions?: number } = {}): CommandResult => {
  const resolver = createSLDResolver(parseProgram(program), options);
  const goalAtom = parseAtom(goal);
  const result = resolver.resolve([goalAtom]);

  if (!result.success || !result.steps) {
    return { command: 'prove', ok: false, verdict: unknown(result.error ?? 'no derivation') };
  }

  const certificate = CertificateGenerator.fromSLDDerivation(goalAtom as unknown as Formula, result.steps, 'sld');
  const verification = new CertificateVerifier(certificate).verify();
  if (!verification.valid) {
    return { command: 'prove', ok: false, verdict: unknown(`invalid certificate: ${verification.errors.join('; ')}`) };
  }
  return { command: 'prove', ok: true, verdict: proved(certificate) };
};

/** Find a model of `formula` (JSON). `ok` is whether one exists; the model is the output. */
export const model = (formula: Formula, options: { maxModels?: number; maxDomainSize?: number } = {}): CommandResult => {
  const finder = createModelFinder(options);
  const result = finder.findModels(formula);
  if (!result.satisfiable) {
    return { command: 'model', ok: false, verdict: unknown('no model within the domain bound') };
  }
  return { command: 'model', ok: true, output: JSON.stringify(result.models[0]) };
};

/** Find a countermodel to `formula` — a model of its negation. */
export const counterexample = (formula: Formula, options: { maxModels?: number; maxDomainSize?: number } = {}): CommandResult => {
  const finder = createModelFinder(options);
  const result = finder.findModels(not(formula));
  if (!result.satisfiable) {
    return { command: 'counterexample', ok: false, verdict: unknown('no countermodel within the domain bound') };
  }
  return { command: 'counterexample', ok: true, verdict: refuted(result.models[0]!) };
};

/** Re-check a serialised certificate without the prover. */
export const check = (certificateJson: string): CommandResult => {
  const verification = verifyCertificate(certificateJson);
  if (!verification.valid) {
    return { command: 'check', ok: false, verdict: unknown(verification.errors.join('; ')) };
  }
  return {
    command: 'check',
    ok: true,
    verdict: proved(JSON.parse(certificateJson) as ProofCertificate),
  };
};

export type ConvertTarget = 'json' | 'narsese' | 'prolog' | 'tptp';

/** Convert a notation. Round-trips narsese ↔ json; renders prolog/tptp from atoms. */
export const convert = (input: string, to: ConvertTarget): CommandResult => {
  try {
    switch (to) {
      case 'json': {
        const parsed = decodeNarsese(input);
        return { command: 'convert', ok: true, output: serializeTerm(parsed.term) };
      }
      case 'narsese': {
        return { command: 'convert', ok: true, output: encodeNarsese(deserializeTerm(input)) };
      }
      case 'prolog': {
        const atom = parseAtom(input);
        const args = atom.args.map(renderArg).join(', ');
        return { command: 'convert', ok: true, output: `${atom.negated ? '\\+' : ''}${atom.predicate}(${args})` };
      }
      case 'tptp': {
        const atom = parseAtom(input);
        const args = atom.args.map(renderArg).join(',');
        return { command: 'convert', ok: true, output: `fof(1, axiom, ${atom.negated ? '~' : ''}${atom.predicate}(${args})).` };
      }
    }
  } catch (error) {
    return { command: 'convert', ok: false, output: error instanceof Error ? error.message : String(error) };
  }
};

/** Render a verdict as one line, for the CLI. */
export const formatVerdict = (verdict: Verdict): string => {
  switch (verdict.status) {
    case 'proved':
      return `proved (${verdict.certificate.engine}, ${verdict.certificate.proof.length} steps)`;
    case 'refuted':
      return `refuted (countermodel size ${verdict.countermodel.domain.length})`;
    case 'unknown':
      return `unknown (${verdict.reason})`;
  }
};

/** Render a term for Prolog/TPTP. */
const renderArg = (arg: import('../kernel/terms').Term): string => {
  if (arg.op === TermOp.VARIABLE) return arg.name;
  if (arg.op === TermOp.CONSTANT) return (arg as { value: string }).value;
  return '?';
};

/** Parse a program from `--program`/positional text; split on newlines when needed. */
export const programOf = (text: string): string => text.replace(/\n+/g, '. ');
