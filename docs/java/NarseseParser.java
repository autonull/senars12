package nars.io;

import com.github.fge.grappa.annotations.DontLabel;
import com.github.fge.grappa.matchers.MatcherType;
import com.github.fge.grappa.matchers.base.AbstractMatcher;
import com.github.fge.grappa.parsers.BaseParser;
import com.github.fge.grappa.rules.Rule;
import com.github.fge.grappa.run.context.MatcherContext;
import com.github.fge.grappa.stack.ArrayValueStack;
import com.github.fge.grappa.support.Var;
import jcog.Is;
import jcog.Str;
import nars.$;
import nars.Op;
import nars.Term;
import nars.subterm.Subterms;
import nars.subterm.TermList;
import nars.subterm.TmpTermList;
import nars.term.Compound;
import nars.term.atom.Atom;
import nars.term.atom.Atomic;
import nars.term.obj.QuantityTerm;
import nars.term.var.CommonVariable;
import nars.term.var.Variable;
import nars.time.Tense;
import org.jetbrains.annotations.Nullable;
import tec.uom.se.AbstractQuantity;

import java.util.List;

import static nars.Op.*;
import static nars.term.atom.Bool.Null;

public class NarseseParser extends BaseParser<Object> {

    public Rule Input() {
        return zeroOrMore( sequence( s(),
            firstOf(
                LineComment(),
                Task(),
                TermCommandTask()
            )
        ));
    }

    public Rule LineComment() {
        return sequence(
                "//",
                zeroOrMore(noneOf("\n")),
                firstOf("\n", eof() /* may not have newline at end of file */)
        );
    }

    public Rule TermCommandTask() {
        return sequence(
                Term(),
                eof(),
                push(newTask(1f, ';', popAs(Term.class), null, new long[]{ETERNAL, ETERNAL}))
        );
    }

    public Rule Task() {

        Var<Float> budget = new Var();
        Var<Character> punc = new Var(COMMAND);
        Var<Object> truth = new Var();
        Var<Object> occurr = new Var(new long[]{ETERNAL, ETERNAL});

        return sequence(

            optional(Budget(budget)),

            Term(),

            Punctuation(punc),

            s(),

            optional(Occurrence(occurr)),

            optional(Truth(), truth.set(pop())),

            newTask(budget, punc, truth, occurr)

        );
    }

    public boolean newTask(Var<Float> budget, Var<Character> punc, Var<Object> truth, Var<Object> occurr) {
        return push(
                newTask(budget.get(), punc.get(), popAs(Term.class), truth.get(), occurr.get())
        );
    }

    public Rule Punctuation(Var<Character> punc) {
        return sequence(anyOf(puncChars), punc.set(matchedChar()));
    }

    public Rule Occurrence(Var<Object> occurr) {
        return
                sequence(
                        OccurrenceTime(),
                        firstOf(
                                sequence("..", OccurrenceTime(), swap(), occurr.set(new Object[]{pop(), pop()})),
                                occurr.set(pop())
                        ), s())
        ;
    }

    public static Object newTask(Float budget, Character punc, Term term, Object truth, Object occ) {
        return new Object[]{budget, term, punc, truth, occ};
    }


    public Rule Budget(Var<Float> budget) {
        return sequence(
                BUDGET_VALUE_MARK,

                ShortFloat(),

                budget.set(popAs(Float.class)),

                optional(BUDGET_VALUE_MARK)
        );
    }


    public Rule Truth() {
        return sequence(
                TRUTH_VALUE_MARK,
                ShortFloat(),
                firstOf(
                    sequence( TRUTH_VALUE_MARK, push(popAs(Float.class))),
                    sequence(
                        ";", ShortFloat(), optional(TRUTH_VALUE_MARK),
                        swap() && push($.t(
                                popAs(Float.class), popAs(Float.class)
                                //popAs(Double.class), popAs(Double.class)
                        ))
                    )
                )
                        /*,

                        sequence(
                                TRUTH_VALUE_MARK, 

                                truth.setAt(new DefaultTruth((float) pop() ))
                        )*/

        );
    }

//    public Rule TruthTenseSeparator(char defaultChar, Var<Tense> tense) {
//        return firstOf(
//                defaultChar,
//                sequence('|', tense.setAt(Tense.Present)),
//                sequence('\\', tense.setAt(Tense.Past)),
//                sequence('/', tense.setAt(Tense.Future))
//        );
//    }


    public Rule ShortFloat() {
        return firstOf(
            sequence(firstOf("1.000", "1.00","1.0","1"),  push((float)1)),
            sequence(firstOf(".", "0."), oneOrMore(digit()), push(Str.f("0." + matchOrDefault("NaN"), 0, 1.0f))),
            sequence("0",  push((float)0))
        );
    }


    public static final char[] puncChars = { '.', '?', '!', '@', ';' };


    @DontLabel public Rule Term() {
        return Term(true, true);
    }


    public Rule Term(boolean oper, boolean temporal) {
        return seq(
                s(),
                firstOf(
                    NegationPrefix(),
                    Product(),

                    Set(),
                    StatementOld(),

                    CompoundInfixTemporal(),
                    CompoundInfix(),
                    CompoundPrefixTemporal(),
                    CompoundPrefix(),

                    DeltaPrefix(),

                    seq(oper && temporal, ColonReverseInh()),

                    Variable(),

                    Struct(),

                    URIAtom(),
                    NumberAtom(),

                    AtomQuoted(),
                    Atom(),

                    seq('\\', push(ImgInt)),
                    seq('/',  push(ImgExt)),
                    seq('_',  push(VarAuto))
                ),
                s()
        );
    }

    /** prolog-like Struct syntax: f(x,y) */
    @Is("Prolog") public Rule Struct() {
        return seq(
            Atom(),
            Product(),
            push(INH.the(popAs(Term.class), popAs(Term.class)))
        );
    }

    public Rule Atom() {
        return seq(AtomStr(), push(Atomic.atomic(popAs(String.class))));
    }

    public Rule CompoundPrefix() {
        return seq(COMPOUND_OPEN, s(),
            MultiArgTerm(null, COMPOUND_CLOSE, true, false)
        );
    }

    public Rule NegationPrefix() {
        return seq(NEG.str, Term(), push(popAs(Term.class).neg()));
    }

    public Rule DeltaPrefix() {
        return seq(trie("/\\", DELTA.str), Term(), push(DELTA.the(popAs(Term.class))));
    }

    public Rule StatementOld() {
        return seq(OLD_STATEMENT_OPENER,
                MultiArgTerm(null, OLD_STATEMENT_CLOSER, false, true)
        );
    }

    public Rule Set() {
        return firstOf(
            seq(SETe.str, MultiArgTerm(SETe, SETe_CLOSE, false, false)),
            seq(SETi.str, MultiArgTerm(SETi, SETi_CLOSE, false, false))
        );
    }

    public Rule Product() {
        return seq(COMPOUND_OPEN, firstOf(
            seq(s(), COMPOUND_CLOSE, push(EmptyProduct)),
            MultiArgTerm(null, COMPOUND_CLOSE, false, false)
        ));
    }


    public Rule URIAtom() {
        return seq(
                //https://stackoverflow.com/questions/163360/regular-expression-to-match-urls-in-java#163398
                regex("^[a-z]+://[-a-zA-Z0-9+&@#/%?=~_|!:,.;]*[-a-zA-Z0-9+&@#/%=~_|]"), push($.quote(match()))
        );
    }

    @DontLabel
    public Rule seq(Object rule, Object rule2,
                    Object... moreRules) {
        return sequence(rule, rule2, moreRules);
    }


    //@Deprecated
    public Rule CompoundInfixTemporal() {

        return seq(COMPOUND_OPEN,

                Term(),

                seq(OpTemporal(), TimeDelta()),

                Term(),
                COMPOUND_CLOSE,

                push(TemporalRelationBuilder(popAs(Term.class) /* pred */,
                        pop() /*cycleDelta*/, popAs(Op.class) /*relation*/, popAs(Term.class) /* subj */))
        );
    }

    public static @Nullable Term TemporalRelationBuilder(Term pred, Object timeDelta, Op o, Term subj) {
        if (subj == null || subj == Null || pred == null || pred == Null)
            return null;
        else {
            if (timeDelta instanceof Integer) {
                return o.the((int) timeDelta, subj, pred);
            } else {
                return $.func(TERM, o.atom,
                    $.p(subj, pred),
                    (QuantityTerm)timeDelta
                );
            }
        }
    }

    public static final String invalidCycleDeltaString = Integer.toString(Integer.MIN_VALUE);

    public Rule TimeDelta() {
        return

                firstOf(
                        TimeUnit(),

                        seq("+-", push(XTERNAL)),
                        seq('+', oneOrMore(digit()),
                                push(Str.i(matchOrDefault(invalidCycleDeltaString)))
                        ),
                        seq('-', oneOrMore(digit()),
                                push(-Str.i(matchOrDefault(invalidCycleDeltaString)))
                        )
                );

    }

    public Rule TimeUnit() {
        return firstOf(
                seq("-", TimeUnit(true)),
                seq("+", TimeUnit(false))
        );
    }

    public Rule TimeUnit(boolean negate) {
        return
                seq(oneOrMore(anyOf(".0123456789")), push(match()),
                        oneOrMore(alpha()), push(1, match()),
                        push(new QuantityTerm(
                                AbstractQuantity.parse(
                                        pop() + " " + timeUnitize(popAs(String.class))
                                ).multiply(negate ? -1 : +1))
                        ))
                ;
    }

    /**
     * translate shortcuts for time units
     */
    public static String timeUnitize(String u) {
        return switch (u) {
            case "years" -> "year";
            case "months" -> "month";
            case "weeks" -> "week";
            case "days" -> "day";
            case "hours", "hr" -> "h";
            case "m", "mins" -> "min";
            case "sec" -> "s";
            default -> u;
        };
    }

    public Rule OccurrenceTime() {
        return
                firstOf(
                        seq(firstOf("now", "|", ":|:"), push(Tense.Present)),

                        TimeUnit(),
                        seq("-", oneOrMore(digit()), push(-Str.i(match()))),
                        seq("+", oneOrMore(digit()), push(Str.i(match())))


                )
                ;
    }


    /**
     * an atomic target, returns a String because the result may be used as a Variable name
     */
    @DontLabel public Rule AtomStr() {
        return seq(ValidAtomCharMatcher, push(match()));
    }

    public Rule AtomQuoted() {
        return seq(
            firstOf(
                    seq("\"\"\"", regex("[\\s\\S]+\"\"\"")),
                    seq('\"', regex("(?:[^\"\\\\]|\\\\.)*\""))
            ),
            push($.quote(match()))
        );
    }

    public Rule NumberAtom() {
        return seq(
            seq(
                optional('-'),
                oneOrMore(digit()),
                optional('.', oneOrMore(digit()))
            ),
            push($.the(Float.parseFloat(matchOrDefault("NaN").toString())))
        );
    }

    public Rule Variable() {
        return firstOf(
            CommonVariable(),
            seq(VAR_INDEP.ch, VariableContent(VAR_INDEP)),
            seq(VAR_DEP.ch, VariableContent(VAR_DEP)),
            seq(VAR_QUERY.ch, VariableContent(VAR_QUERY)),
            seq(VAR_PATTERN.ch, VariableContent(VAR_PATTERN))
        );
    }

    protected static final char[] VarChars = {VAR_DEP.ch, VAR_INDEP.ch, VAR_QUERY.ch, VAR_PATTERN.ch};

    public Rule CommonVariable() {
        Class<Variable> v = Variable.class;
        return seq(anyOf(VarChars), firstOf(
            seq(repeat(Variable()).times(5),
                push(CommonVariable.parse(popAs(v), popAs(v), popAs(v), popAs(v), popAs(v)))),
            seq(repeat(Variable()).times(4),
                push(CommonVariable.parse(popAs(v), popAs(v), popAs(v), popAs(v)))),
            seq(Variable(), Variable(), Variable(),
                push(CommonVariable.parse(popAs(v), popAs(v), popAs(v)))),
            seq(Variable(), Variable(),
                push(CommonVariable.parse(popAs(v), popAs(v))))
        ));
    }

    @DontLabel
    public Rule VariableContent(Op varType) {
        return seq(AtomStr(), push($.v(varType, popAs(String.class))));
    }

    public Rule Op() {
        return sequence(
                trie(
//                        SECTe.str, SECTi.str,

                        PROD.str,

                        INH.str,

                        SIM.str,
                        DIFF.str,

                        NEG.str,

                        IMPL.str,

                        CONJ.str
                ),

                push(opMatch())
        );
    }

    public Rule OpTemporal() {
        return seq( firstOf(IMPL.str, CONJ.str), push(opMatch()));
    }

    public Op opMatch() {
        return op(match().toString());
    }


    @Deprecated private static final Object functionalForm = new Object();

    /**
     * list of terms prefixed by a particular compound target operate
     */
    @Deprecated
    public Rule MultiArgTerm(@Nullable Op defaultOp, char close, boolean initialOp, boolean allowInternalOp) {
        return seq(
                push(Compound.class),

                initialOp ?
                    Op() :
                    Term(),

                allowInternalOp ?
                    sequence(Op(), Term()) :
                    zeroOrMore(sequence(ARGUMENT_SEPARATOR,  Term())),

                close,

                push(popTerm(defaultOp))
        );
    }

    /**
     * HACK
     */

    public Rule CompoundPrefixTemporal() {

        return sequence(

                COMPOUND_OPEN,  s(),

                firstOf(
                        DISJstr,
                        "&|", "&&+-", "||+-",
                        "&", "|" //TEMPORARY
//                        DIFFe, DIFFi //??
                ),
                push(match()),

                s(),
                ARGUMENT_SEPARATOR,

                push(Compound.class),
                push(PROD),

                Term(),
                zeroOrMore(sequence(
                        ARGUMENT_SEPARATOR,
                        Term()
                )),

                COMPOUND_CLOSE,

                push(buildCompound(popTerms(new Op[]{PROD} /* HACK */), popAs(String.class)))
        );
    }

    /** @param x subterm arguments */
    public static Term buildCompound(List<Term> x, String op) {
        if (x == null) return Null;

        return switch (op) {
            case "&", "&&" -> CONJ.the(x);
            case "&|" -> CONJ.the(0, x);
            case "&&+-" -> CONJ.the(XTERNAL, x); //TEMPORARY
            case "|", DISJstr -> DISJ(x.toArray(EmptyTermArray));
            case "||+-" -> CONJ.the(XTERNAL, $.neg(x.toArray(EmptyTermArray))).neg();
            case "=|>" -> IMPL.the(0, x);
            case "-{-" -> two(x) ? $.inst(x.get(0), x.get(1)) : Null;
            case "-]-" -> two(x) ? $.prop(x.get(0), x.get(1)) : Null;
            case "{-]" -> two(x) ? $.instprop(x.get(0), x.get(1)) : Null;
            default -> op(op).the(x);
//            case DIFFi -> two(x) ?
//                    CONJ.the(x.get(0), x.get(1).neg()) :
//                    Null; //throw new Narsese.NarseseException("diff requires 2 args");
//            case DIFFe -> two(x) ?
//                    DISJ(x.get(0), x.get(1).neg()) :
//                    Null; //throw new Narsese.NarseseException("diff requires 2 args");
        };
    }

    private static boolean two(List<Term> x) {
        return x.size() == 2;
    }

    /**
     * y:x |- <x --> y>
     */
    public Rule ColonReverseInh() {
        return seq(
            Term(false, false), ':', Term(true,true),
            push(INH.the(popAs(Term.class), popAs(Term.class)))
        );
    }

//    public Rule Equality() {
//        return seq(
//                EqualityContent(),
//                push(EQ.the(popAs(Term.class), popAs(Term.class)))
//        );
//    }
//
//    @DontLabel public Rule EqualityContent() {
//        return seq(EqualitySubterm(), Op.EQ.str, EqualitySubterm());
//    }

//    @DontLabel public Rule EqualitySubterm() {
//        return Term(true,true,false);
//    }

    public Rule CompoundInfix() {

        return sequence(COMPOUND_OPEN,

                Term(),

                firstOf(
                        DISJstr,
                        "&", "|",
                        INH.str,
                        SIM.str,
                        DIFF.str,
                        IMPL.str,
//                        DIFFi,
//                        DIFFe,
                        PROD.str,
                        CONJ.str,
                        "&|",
                        "=|>",
                        "-{-",
                        "-]-",
                        "{-]",
                        EQ.str
                ), push(1, match()),

                Term(),

                COMPOUND_CLOSE,

                push(buildCompound(new TermList(popAs(Term.class, 1), popAs(Term.class)), popAs(String.class)))
        );
    }


    /**
     * produce a target from the terms (& <=1 NALOperator's) on the value stack
     */
    @Deprecated
    public final @Nullable Term popTerm(Op op /*default */) {


        Op[] opp = { op };
        TmpTermList vectorterms = popTerms(opp);
        if (vectorterms == null)
            return Null;

        op = opp[0]; if (op == null) op = PROD;

        return op.the((Subterms)vectorterms);
    }

    public TmpTermList popTerms(Op[] op /* hint */) {

        TmpTermList tt = null;

        ArrayValueStack<Object> stack = (ArrayValueStack) getContext().getValueStack();

        while (!stack.isEmpty()) {
            Object p = pop();

            if (p instanceof Object[] pp) {

                if (pp.length > 1) {
                    for (int i = pp.length - 1; i >= 1; i--)
                        stack.push(pp[i]);
                }

                p = pp[0];
            }


            if (p == functionalForm) {
                op[0] = ATOM;
                break;
            }

            if (p == Compound.class) break;

            switch (p) {
                case String s -> {
                    if (tt == null) tt = new TmpTermList(2);
                    tt.add(Atomic.atomic(s));
                }
                case Term term -> {
                    if (p == Null) {
                        stack.clear();
                        return null;
                    }
                    if (tt == null) tt = new TmpTermList(2);
                    tt.add(term);
                }
                case Op op1 -> {
                    if (op != null)
                        op[0] = (Op) p;
                }
                case null, default -> {
                }
            }
        }

        if (tt!=null) {
            tt.reverseThis();

            return tt;
        } else
            return null;

    }

    /**
     * whitespace, optional
     */


    protected static final AbstractMatcher ValidAtomCharMatcher = new AbstractMatcher("'ValidAtomChar'") {

        @Override
        public boolean hasCustomLabel() {
            return false;
        }

        @Override
        public MatcherType getType() {
            return MatcherType.TERMINAL;
        }

        @Override
        public <V> boolean match(MatcherContext<V> c) {
            int count = 0;
            int avail = c.getInputBuffer().length() - c.getCurrentIndex();

            while (count < avail && Atom.validAtomChar(c.getCurrentChar())) {
                c.advanceIndex(1);
                count++;
            }

            return count > 0;
        }
    };

    @DontLabel public Rule s() {
        return regex("\\s*");
    }

}