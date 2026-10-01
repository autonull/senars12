// Narsese Grammar for Peggy Parser - senars12 version
// Based on proven senars11 parser design
//
// Every kind named here is an `OPERATORS` key, and every symbol is that key's
// `OPERATORS[kind].symbol`. `pnpm terms:canonical` fails if the two tables
// disagree, so the grammar cannot name a kind the term layer has no entry for.

{{
  // Canonical spelling only: one entry per `OPERATORS` key, and each value is the
  // symbol the serialiser writes. `LEGACY_KINDS` are older spellings Narsese
  // readers still meet; they resolve to the same kinds and nothing else.
  const INFIX_KINDS = {'-->': 'inheritance', '<->': 'similarity', '==>': 'implication', '<=>': 'equivalence', '=/>': 'predictive', '=|': 'retrospective', '&': 'conjunction', '|': 'disjunction', '&|': 'parallel', '&/': 'sequence', '^': 'operation'};
  // The wrapper operators are absent on purpose: `--`, the open brace and the
  // open bracket are literals in the rules that spell them, and peggy's
  // initializer counts braces, so those symbols cannot appear here at all.
  const LEGACY_KINDS = {'&&': 'conjunction', '||': 'disjunction', '=>': 'implication', ',/': 'sequence'};
  const kindOf = (symbol) => INFIX_KINDS[symbol] ?? LEGACY_KINDS[symbol];
  const operatorKind = (symbol) => {
    const kind = kindOf(symbol);
    if (!kind) error(`'${symbol}' is not an operator`);
    return kind;
  };
}}

start = _ content:(Task / Term) _ { return content; }

Task "task"
  = term:Term punc:Punctuation truth:TruthValue? {
      let taskType = 'BELIEF';
      if (punc === '?') taskType = 'QUESTION';
      else if (punc === '!') taskType = 'GOAL';
      else if (punc === '@') taskType = 'QUEST';
      else if (punc === ';') taskType = 'COMMAND';
      
      return {
        term: term,
        punctuation: punc,
        truthValue: truth,
        taskType: taskType
      };
    }

Punctuation
  = _ punc:[.!?@;] { return punc; }

TruthValue
  = _ "%" _ f:Float _ ";" _ c:Float _ "%" {
      if (f < 0 || f > 1 || c < 0 || c > 1) {
        error(`Truth values out of range: frequency=${f} (0-1), confidence=${c} (0-1)`);
      }
      return { frequency: f, confidence: c };
    }
  / _ "%" _ f:Float _ "%" {
      if (f < 0 || f > 1) {
        error(`Frequency value out of range: ${f} (should be 0-1)`);
      }
      return { frequency: f, confidence: 0.9 };
    }

Term "term"
  = Statement
  / CompactInheritance
  / NegationTerm
  / DeltaTerm
  / CompoundTerm
  / Set
  / Variable
  / ImagePlaceholder
  / AtomicTerm

// The callee in `f(x, y)`. Colons are allowed because an operation name is an
// atom in every other position, and `profile:test` has to name the same atom
// here as it does there.
OperationAtomicTerm "operation atomic term (allows colons)"
  = StringLiteral
  / ColonedAtom
  / chars:$([^(){}[\]<>.,!%?;@ \t\n\r=&/|>^-]+) { return options.termFactory.atom(chars); }

ColonedAtom "namespaced atomic term with colons"
  = head:$([^(){}[\]<>.,!%?;@ \t\n\r=&/|>^-]+) tail:$(":" [^(){}[\]<>.,!%?;@ \t\n\r=&/|>-]+)+ {
      return options.termFactory.atom(head + tail.join(''));
    }

CompactInheritance
  = pred:AtomicTerm ":" subj:Term {
      return options.termFactory.inheritance(subj, pred);
    }

NegationTerm
  = "--" term:Term { return options.termFactory.negation(term); }

DeltaTerm
  = "Δ" term:Term { return options.termFactory.delta(term); }
  / "/\\" term:Term { return options.termFactory.delta(term); }

ImagePlaceholder
  = "\\" { return options.termFactory.atom('\\'); }
  / "/" { return options.termFactory.atom('/'); }

CompoundTerm
  = "(" _ "--" _ term:Term _ ")" {
      return options.termFactory.negation(term);
    }
  / "(" _ symbol:OperatorSymbol _ ","? _ components:TermList _ ")" {
      // `^` is the operation sigil, not an infix copula: it cannot head a
      // compound. `(^apply_fix-->patch)` used to read as a one-argument
      // operation whose argument was a bare statement chain — a term no
      // serialiser writes, which prints as the empty string. A `^` in the
      // leading position is the retired `^name` form, and it is a parse error.
      if (symbol === "^") error("'^' is the operation sigil and cannot open a compound");
      return options.termFactory.create(operatorKind(symbol), components);
    }
  / operator:OperationAtomicTerm "(" _ components:TermList? _ ")" {
      const args = components || [];
      return options.termFactory.operation(
        operator,
        args.length === 1 ? args[0] : options.termFactory.product(...args)
      );
    }
  / "(" _ components:TermList? _ ")" {
      return options.termFactory.product(...(components || []));
    }

Statement
  = AngleBracketStatement
  / ParenthesizedStatement

AngleBracketStatement
  = "<" _ subject:Term _ op:InfixOperator _? _ predicate:Term _ ">" {
      return options.termFactory.create(operatorKind(op.trim()), [subject, predicate]);
    }

ParenthesizedStatement
  = "(" _ subject:Term _ op:InfixOperator _? _ predicate:Term _ ")" {
      return options.termFactory.create(operatorKind(op.trim()), [subject, predicate]);
    }

// The two rules are the same token list read at two syntactic positions: after
// a compound's opening paren, and between two terms. Trailing `,` is the
// `<a, --> b>` shorthand, which the operator is written after in.
OperatorSymbol = op:OperatorToken { return op.endsWith(',') ? op.slice(0, -1) : op; }
InfixOperator = op:OperatorToken { return op; }

OperatorToken
  = "-->" / "<->" / "==>" / "<=>" / "=/>" / "=|" / "&|" / "&/" / "^" / "&" / "|"
  / "&&" / "||" / "=>" / ",/"
  / "-->," / "<->," / "==>," / "<=>," / "&," / "|,"

TermList
  = head:Term tail:(_ "," _ Term)* {
      const terms = [head];
      if (tail) {
        for (const t of tail) {
          terms.push(t[3]);
        }
      }
      return terms;
    }

Set
  = "{" _ components:TermList? _ "}" { return options.termFactory.create('setExt', components || []); }
  / "[" _ components:TermList? _ "]" { return options.termFactory.create('setInt', components || []); }

// `^` is an operator symbol and never an atom character — it is the only reason
// `(a^b)` reads as a compound and not as one atom named `a^b`.
AtomicTerm "atomic term"
  = StringLiteral
  / chars:$([^(){}[\]<>.,!%?;:@ \t\n\r=&/|>^-]+) { return options.termFactory.atom(chars); }

StringLiteral
  = '"' chars:$([^"]*) '"' { return options.termFactory.atom('"' + chars + '"'); }

Variable "variable"
  = varName:$([?$#*%][^(){}[\]<>.,!%?; \t\n\r=&/|>-]*) { return options.termFactory.atom(varName); }

Float "float"
  = val:$("-"? [0-9]+ ("." [0-9]+)?) { return parseFloat(val); }

_ "whitespace"
  = [ \t\n\r]*
