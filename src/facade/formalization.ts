import type { NLContext } from '../nl/understanding';
import type { Formalizer, PerceivedAdmission, PerceivedInterpretation } from '../nl/formalizer';
import { createFormalizer, validateInterpretation } from '../nl/formalizer';
import type { Explanation, ConflictExplanation, ExplanationSource } from '../nl/explanation';
import { ExplanationGenerator } from '../nl/explanation';
import { getArgs, termsEqual, type Term } from '../terms';
import type { NARFacadePort } from './ports';

let formalizerCache = new WeakMap<NARFacadePort, Formalizer>();
let explanationGeneratorCache = new WeakMap<NARFacadePort, ExplanationGenerator>();

export function getFormalizer(nar: NARFacadePort): Formalizer {
  if (!formalizerCache.has(nar)) {
    formalizerCache.set(nar, createFormalizer(nar.getLMClient()));
  }
  return formalizerCache.get(nar)!;
}

export function formalize(nar: NARFacadePort, text: string, ctx?: NLContext): Promise<PerceivedInterpretation> {
  return getFormalizer(nar).nlToFormal(text, ctx);
}

export async function perceive(nar: NARFacadePort, text: string, ctx?: NLContext): Promise<PerceivedAdmission> {
  const raw = await getFormalizer(nar).nlToFormal(text, ctx);
  const { interpretation, rejected: invalid } = validateInterpretation(raw);
  const llm = interpretation.createdBy === 'llm-proposed';
  const { admitted, rejected: gateRejected } = nar
    .getPerceptionGate()
    .admitFormalization(interpretation, llm ? 'LLM_PRIOR' : 'GENERAL', llm ? 'llm' : 'user');
  for (const task of admitted) nar.io.storeAdmitted(task);
  return {
    interpretation,
    admitted,
    rejected: [
      ...(interpretation.rejection ? [{ candidateId: '', reason: interpretation.rejection }] : []),
      ...invalid,
      ...gateRejected,
    ],
  };
}

function getExplanationGenerator(nar: NARFacadePort): ExplanationGenerator {
  if (!explanationGeneratorCache.has(nar)) {
    const recorder = nar.getProcessor().getRecorder();
    const source: ExplanationSource = {
      firesByConclusion: (term) => recorder.firesByConclusion(term),
    };
    const lm = nar.getLMClient();
    const paraphrase = lm
      ? (input: import('../nl/generation').GenerationInput) => getFormalizer(nar).formalToNl(input)
      : undefined;
    explanationGeneratorCache.set(nar, new ExplanationGenerator({ source, paraphrase }));
  }
  return explanationGeneratorCache.get(nar)!;
}

export async function explainDerivation(nar: NARFacadePort, conclusion: string | Term): Promise<Explanation> {
  const term = typeof conclusion === 'string' ? conclusion : conclusion.toString();
  const explanation = await getExplanationGenerator(nar).explain(term);
  nar.getSystemEventBus().emit('explanation', {
    conclusion: explanation.conclusion,
    derivationIds: explanation.derivationIds,
    rules: explanation.rules,
    steps: explanation.steps,
    paraphrased: explanation.paraphrase !== undefined,
  });
  return explanation;
}

export function findContradictions(nar: NARFacadePort): Array<{ a: string; b: string }> {
  const terms = nar.memory
    .listConcepts()
    .filter((concept) => concept.topBelief() !== undefined)
    .map((concept) => concept.term);
  const pairs: Array<{ a: string; b: string }> = [];
  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      const [a, b] = [terms[i]!, terms[j]!];
      if (!termsEqual(a, b) && contradicts(a, b)) {
        pairs.push({ a: a.toString(), b: b.toString() });
      }
    }
  }
  return pairs;
}

function contradicts(a: Term, b: Term): boolean {
  if (termsEqual(a, b)) return true;
  const [aArg] = a.kind === 'negation' ? getArgs(a) : [];
  const [bArg] = b.kind === 'negation' ? getArgs(b) : [];
  return (!!aArg && termsEqual(aArg, b)) || (!!bArg && termsEqual(bArg, a));
}

export async function explainConflict(nar: NARFacadePort, a: string | Term, b: string | Term): Promise<ConflictExplanation> {
  const asString = (term: string | Term) => (typeof term === 'string' ? term : term.toString());
  const conflict = await getExplanationGenerator(nar).explainConflict(asString(a), asString(b));
  nar.getSystemEventBus().emit('explanation', {
    conclusion: `${conflict.terms[0]} \u2295 ${conflict.terms[1]}`,
    derivationIds: conflict.derivationIds,
    rules: conflict.rules,
    steps: conflict.steps,
    paraphrased: false,
    conflict: true,
  });
  return conflict;
}