// Narsese Grammar for Peggy Parser v38
start
  = _ content:(Task / Term) _ { return content; }

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
  = "\\" { return options.termFactory.atomic('\\'); }
  / "/" { return options.termFactory.atomic('/'); }

CompoundTerm
  = "(" _ op:Operator _ ","? _ components:TermList _ ")" {
      return options.termFactory.create(op, components);
    }
  / operator:AtomicTerm "(" _ components:TermList? _ ")" {
      return options.termFactory.create(operator.name, components || []);
    }
  / "(" _ components:TermList? _ ")" {
      return options.termFactory.tuple(components || []);
    }

Statement
  = AngleBracketStatement
  / ParenthesizedStatement

AngleBracketStatement
  = "<" _ subject:Term _ op:InfixOperator _ predicate:Term _ ">" {
      return options.termFactory.create(op.trim(), [subject, predicate]);
    }

ParenthesizedStatement
  = "(" _ subject:Term _ op:InfixOperator _ predicate:Term _ ")" {
      return options.termFactory.create(op.trim(), [subject, predicate]);
    }

Operator
  = op:("-->" / "<->" / "==>" / "<=>" / "<~>" / "=/>" / "=|" / "=/=" / "=" / "&&" / "||" / "&|" / "&/" / "&," / "|," / "-->," / "<->," / "==>," / "<=>," / "--") { return op.endsWith(',') ? op.slice(0, -1) : op; }

InfixOperator
  = op:("-->" / "<->" / "==>" / "<=>" / "<~>" / "=/>" / "=|" / "=/=" / "=" / "&&" / "||" / "&|" / "&/") { return op; }

Set
  = "{" _ components:TermList? _ "}" { return options.termFactory.setExt(components || []); }
  / "[" _ components:TermList? _ "]" { return options.termFactory.setInt(components || []); }

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

AtomicTerm "atomic term"
  = StringLiteral
  / chars:$([^(){}<>.,!%?;:@ \t\n\r=&/|>-]+) { return options.termFactory.atomic(chars); }

StringLiteral
  = '"' chars:$([^"]*) '"' { return options.termFactory.atomic('"' + chars + '"'); }

Variable "variable"
  = varName:$([?$#*%][^(){}<>.,!%?; \t\n\r=&/|>-]*) { return options.termFactory.atomic(varName); }

Float "float"
  = val:$("-"? [0-9]+ ("." [0-9]+)?) { return parseFloat(val); }

_ "whitespace"
  = [ \t\n\r]*
