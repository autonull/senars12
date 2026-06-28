package nars;


import jcog.Config;
import jcog.Is;
import jcog.Util;
import jcog.math.LongInterval;
import nars.subterm.ArraySubterms;
import nars.subterm.Subterms;
import nars.task.AbstractCommandTask;
import nars.term.Compound;
import nars.term.Neg;
import nars.term.Termlike;
import nars.term.atom.*;
import nars.term.builder.MultiInterningTermBuilder;
import nars.term.builder.SimpleTermBuilder;
import nars.term.builder.SmartTermBuilder;
import nars.term.builder.TermBuilder;
import nars.term.compound.CachedCompound;
import nars.term.util.TermException;
import nars.term.var.UnnormalizedVariable;
import org.eclipse.collections.api.map.ImmutableMap;
import org.eclipse.collections.api.tuple.primitive.IntIntPair;
import org.eclipse.collections.api.tuple.primitive.ObjectIntPair;
import org.eclipse.collections.impl.factory.Maps;
import org.jetbrains.annotations.Nullable;

import java.io.IOException;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Stream;

import static nars.subterm.Subterms.array;
import static nars.term.atom.Bool.*;
import static org.eclipse.collections.impl.tuple.primitive.PrimitiveTuples.pair;

/**
 * NAL symbol table
 */
public enum Op {

    ATOM(".", Op.ANY_LEVEL, Args.Zero),

    NEG("--", 1, Args.One) {
        @Override
        @Deprecated public Term build(TermBuilder B, int dt, Term[] u) {
            if (u.length != 1 || dt!=DTERNAL)
                throw new TermException("negation requires one subterm and no temporality", NEG, dt, u);

            return B.neg(u[0]);
        }

    },

    INH("-->", 1, Args.Two) {
        @Override public Term build(TermBuilder B, int dt, Term[] u) {
            return B.statement(this, dt, u);
        }

        @Override
        public Term build(TermBuilder B, int dt, Subterms u) {
            return B.statement(this, dt, u);
        }
    },

    SIM("<->", true, 2, Args.Two) {
        @Override public Term build(TermBuilder B, int dt, Term[] u) {
            return B.statement(this, dt, u);
        }
        @Override public Term build(TermBuilder B, int dt, Subterms u) {
            return B.statement(this, dt, u);
        }
    },

//    /**
//     * extensional intersection
//     */
//    @Deprecated SECTe("&", true, 3, Args.GTETwo) {
//        @Override
//        public Term the(TermBuilder b, int dt, Term[] u) {
//            return CONJ.the(b, dt, u);
//            //throw new WTF();
//            //return SetSectDiff.intersect(b, SECTe, u);
//        }
//    },
//
//    /**
//     * intensional intersection
//     */
//    @Deprecated SECTi("|", true, 3, Args.GTETwo) {
//        @Override
//        public Term the(TermBuilder b, int dt, Term[] u) {
//            return CONJ.the(b, dt, $.neg(u)).neg(); //DISJ
//            //throw new WTF();
//            //return SetSectDiff.intersect(b, SECTi, u);
//        }
//    },


    /**
     * PRODUCT
     * classically this is considered NAL4 but due to the use of functors
     * it is much more convenient to classify it in NAL1 so that it
     * along with inheritance (INH), which comprise the functor,
     * can be used to compose the foundation of the system.
     */
    PROD("*", 1, Args.GTEZero),


    /**
     * conjunction
     * &&   parallel                (a && b)          <= (b && a)
     * &&+  sequence forward        (a &&+1 b)
     * &&-  sequence reverse        (a &&-1 b)        =>      (b &&+1 a)
     * &&+- variable                (a &&+- b)        <=      (b &&+- a)
     * &|   joined at the start     (x &| (a &&+1 b)) => ((a&&x) &&+1 b)
     * |&   joined at the end       (x |& (a &&+1 b)) => (     a &&+1 (b&&x))   //TODO
     * <p>
     * disjunction
     * ||   parallel                (a || b)          => --(--a &&   --b)
     * ||+- variable                (a ||+- b)        => --(--a &&+- --b)
     */
    CONJ("&&", true, 5, Args.GTETwo) {
        @Override
        public Term build(TermBuilder B, int dt, Term[] u) {
            return B.conj(dt, u);
        }

        @Override
        public Term build(TermBuilder B, int dt, Subterms u) {
            return B.conj(dt, array(u));
        }
    },


    /**
     * intensional setAt
     */
    SETi("[", true, 2, Args.GTEOne),

    /**
     * extensional setAt
     */
    SETe("{", true, 2, Args.GTEOne),


    /**
     * implication
     * https://en.wikipedia.org/wiki/Material_conditional
     * http://mathworld.wolfram.com/Implies.html
     */
    IMPL("==>", 5, Args.Two) {
        @Override public Term build(TermBuilder B, int dt, Term[] u) {
            return B.statement(this, dt, u);
        }
        @Override
        public Term build(TermBuilder B, int dt, Subterms u) {
            return B.statement(this, dt, u);
        }
    },


    /**
     * $ most specific, least globbing
     */
    VAR_PATTERN('%', Op.ANY_LEVEL),
    VAR_QUERY('?', Op.ANY_LEVEL),
    VAR_INDEP('$', 5),
    VAR_DEP('#', 5),


    /**
     * % least specific, most globbing
     */

    INT("+", Op.ANY_LEVEL),

    BOOL("B", Op.ANY_LEVEL),

    IMG("/", 4),

    EQ("=", true, 1, Args.Two) {
        @Override
        public Term build(TermBuilder B, int dt, Term[] u) {
            return switch (u.length) {
                case 1 -> True; //HACK assumes it's an (x==x) commutive collapse
                case 2 -> B.equal(u[0], u[1]);
                default -> throw new TermException("equality requires arity=2");
            };
        }

    },
    DIFF("<~>", true, 2, Args.Two) {
        @Override
        public Term build(TermBuilder B, int dt, Term[] u) {
            if (u.length!=2)
                throw new TermException("same requires arity=2");
            Term a = u[0], b = u[1];
            if (a instanceof Bool || b instanceof Bool)
                return Null; //HACK why
            return a.equalsPN(b) ?
                (((a instanceof Neg) == (b instanceof Neg)) ? True : False) :
                super.build(B, dt, u);
        }
    },

    /** Δ aka /\ */
    DELTA("Δ", 1, Args.One) {
        //public static final String str2 = "/\\"; /* /\x */

        @Override
        public Term build(TermBuilder B, int dt, Term... u) {
            final Term x = u[0];
            if (x instanceof Neg)
                return super.build(B, dt, x.unneg()).neg(); //unwrap neg to outer

            if (x instanceof Bool || x instanceof Int)
                return Null;

            return super.build(B, dt, u);
        }
    }
    ;
    /**
     * integer version of long ETERNAL
     */
    public static final int DTERNAL = Integer.MIN_VALUE;


    public static final int AtomicConstant = or(ATOM, INT /*, BOOL*/);
    public static final int FuncInnerBits = or(ATOM, PROD);
    public static final int FuncBits = FuncInnerBits | INH.bit;

    public static final byte BELIEF = '.';
    public static final byte QUESTION = '?';
    public static final byte GOAL = '!';
    public static final byte QUEST = '@';
    public static final byte COMMAND = ';';
    public static final byte[] Punctuation = {BELIEF, QUESTION, GOAL, QUEST, COMMAND};

    public static final char BUDGET_VALUE_MARK = '$';
    public static final char TRUTH_VALUE_MARK = '%';
    public static final char VALUE_SEPARATOR = ';';
    public static final char ARGUMENT_SEPARATOR = ',';
    public static final char SETi_CLOSE = ']';
    public static final char SETe_CLOSE = '}';
    public static final char COMPOUND_OPEN = '(';
    public static final char COMPOUND_CLOSE = ')';
    @Deprecated
    public static final char OLD_STATEMENT_OPENER = '<';
    @Deprecated
    public static final char OLD_STATEMENT_CLOSER = '>';
    public static final char STAMP_OPENER = '{';
    public static final char STAMP_CLOSER = '}';
    public static final String DISJstr = "||";
    public static final char STAMP_SEPARATOR = ';';
    public static final char STAMP_STARTER = ':';
    public static final char VarAutoSym = '_';
    public static final char DeltaChar = 'Δ';

    /**
     * anonymous depvar
     */
    @Is("Prolog")
    public static final UnnormalizedVariable VarAuto = new UnnormalizedVariable(VAR_DEP, String.valueOf(VarAutoSym));


    public static final char NullSym = '☢';
    public static final char imIntSym = '\\';
    public static final char imExtSym = '/';
    public static final Img ImgInt = Img.Int;
    public static final Img ImgExt = Img.Ext;
    public static final Term ImgIntNeg = new Neg.NegIntrin(ImgInt);
    public static final Term ImgExtNeg = new Neg.NegIntrin(ImgExt);

    public static final int Set = or(SETe, SETi);

    public static final int Temporals = or(CONJ, IMPL);
    public static final int UnBeliefableStructure = or(VAR_QUERY);
    public static final int UnGoalableStructure = or(VAR_QUERY, IMPL);
    public static final Term[] EmptyTermArray = new Term[0];
    public static final Compound[] EmptyCompoundArray = new Compound[0];
    public static final Subterms EmptySubterms = new ArraySubterms(EmptyTermArray);
    public static final Compound EmptyProduct = CachedCompound.the(PROD, EmptySubterms);

    /** inner builder for ephemeral instantiation */
    public static final TermBuilder terms_ =
        SmartTermBuilder.the;

    /** light-weight term builder */
    public static final TermBuilder terms__ =
        SimpleTermBuilder.the;

    private static final int termInterningVol = Config.INT("terminterning", NAL.term.interningComplexityMax);

    /**
     * global builder for durable instantiation
     */
    public static final TermBuilder terms = termInterningVol <= 0 ?
        terms_
        :
        new MultiInterningTermBuilder(terms_, termInterningVol);
        //new MemoizingTermBuilder(_terms);

    /**
     * False wrapped in a subterm as the only element
     * determines what compound terms can shield subterms from recursion restrictions
     */
    @Is("Closure_(computer_programming)") public static final Predicate<Compound> statementClosure =
        //x->true;
        x->x.isAny(~PROD.bit);
        //x->x.isAny(~(PROD.bit | INH.bit | SIM.bit));

    public static final char NaNChar = '⍉';
    public static final char InfinityPosChar = '∞';
    public static final char InfinityNegChar = '⧞';
    public static final Atom NaN = new Atom(String.valueOf(NaNChar));
    public static final Atom InfinityPos = new Atom(String.valueOf(InfinityPosChar));
    public static final Atom InfinityNeg = new Atom(String.valueOf(InfinityNegChar));

    public static final long ETERNAL = LongInterval.ETERNAL;
    public static final long TIMELESS = LongInterval.TIMELESS;

    /** before or after-ternal */
    public static final int XTERNAL = Integer.MAX_VALUE;

    public static final String UNCONCEPTUALIZABLE = "unconceptualizable";

    public static final Predicate<Term>
        isAtomic   = z -> z instanceof Atomic,
        isCompound = z -> z instanceof Compound;

    /*
    //before-ternal TODO
    public static final int BTERNAL = Integer.MAX_VALUE - 1;

    // after-ternal TODO
    public static final int ATERNAL = Integer.MAX_VALUE - 2;

    public static final String TENSE_PAST = ":\\:";
    public static final String TENSE_PRESENT = ":|:";
    public static final String TENSE_FUTURE = ":/:";
    public static final String TENSE_ETERNAL = ":-:";
    public static final String TASK_RULE_FWD = "|-";
     */


    private static final Op[] ops = values();
    public static final int count = ops.length;
    //_terms;
    //new InterningTermBuilder();
    //new MemoizingTermBuilder1(_terms);

    /**
     * True wrapped in a subterm as the only element
     */
    public static final int Compounds = or(all().filter(x->!x.atomic));

    //     x -> !x.isAny(
//            Op.PROD.bit
//            PROD.bit | IMPL.bit
//            //Op.PROD.bit | Op.SETe.bit | Op.SETi.bit
//            //Op.PROD.bit | Op.CONJ.bit
//            //Op.PROD.bit | Op.INH.bit | Op.SIM.bit | Op.IMPL.bit
//    );
    public static final int Variables = or(all().filter(x->x.var));
    public static final int Conceptualizables = or(all().filter(x->x.conceptualizable));
    public static final int Taskables = or(all().filter(x->x.taskable));
    public static final int Commutatives = or(all().filter(x->x.commutative));
    public static final int Statements = or(all().filter(x->x.statement));
    //public static final int ArityVary = or(all().filter(x->x.maxSubs != x.minSubs));

    /* terms which can be a sub-condition ie. event */
    public static final int Condables = or(all().filter(x->x.condable));

    /**
     * specifier for any NAL level
     */
    private static final int ANY_LEVEL = 0;
    private static final ImmutableMap<String, Op> stringToOp;
    private static final ImmutableMap<Atom, Op> termToOp;

    public static final Atom TERM = atom("term");

    public static final int VarTypes = 4;

    static {

        Map<String, Op> sto = new HashMap<>(values().length * 2, 1f);
        Map<Atom, Op> tto = new HashMap<>(values().length * 2, 1f);
        for (Op r : values()) {
            sto.put(r.toString(), r);
            tto.put(r.atom, r);
        }
        sto.put("&", CONJ); tto.put(atom("\"&\""), CONJ);

        stringToOp = Maps.immutable.ofMap(sto);
        termToOp = Maps.immutable.ofMap(tto);
    }

    public final Atom atom;

    /**
     * whether it is a special or atomic target that isnt conceptualizable.
     * negation is an exception to this, being unconceptualizable itself
     * but it will have conceptualizable=true.
     */
    public final boolean conceptualizable;
    public final boolean taskable;
    public final boolean beliefable, goalable;

    /** -1 if not a variable; otherwise the canonical varType of the variable */
    public final int varType;

    /**
     * string representation
     */
    public final String str;
    /**
     * character representation if symbol has length 1; else ch = 0
     */
    public final char ch;
    /**
     * arity limits, range is inclusive >= <=
     * TODO replace with an IntPredicate
     */
    public final int subsMin, subsMax;
    /**
     * minimum NAL level required to use this operate, or 0 for N/A
     */
    public final int levelMin;
    public final boolean commutative;
    public final boolean temporal;
    /**
     * 1 << op.ordinal
     */
    public final int bit;
    public final boolean var;
    public final boolean atomic;
    public final boolean statement;

    /**
     * whether this involves a numeric component: 'dt' (for temporals) or 'relation' (for images)
     */
    public final boolean hasNumeric;

    public final byte id;

    /**
     * whether the target of this op is valid, by itself, as a condition
     */
    public final boolean condable;

    /** something that can be a condition or negated condition of a conjunction */
    public final boolean set;

    Op(char c, int levelMin) {
        this(c, levelMin, Args.Zero);
    }

    Op(char c, int levelMin, IntIntPair size) {
        this(Character.toString(c), levelMin, size);
    }

    Op(String string, int levelMin) {
        this(string, false /* non-commutive */, levelMin, Args.Zero);
    }


    Op(String string, int levelMin, IntIntPair size) {
        this(string, false /* non-commutive */, levelMin, size);
    }

    Op(String string, boolean commutative, int levelMin, IntIntPair size) {

        this.id = (byte) (ordinal());
        this.str = string;
        this.ch = string.length() == 1 ? string.charAt(0) : 0;
        this.atom = //ch != '.' ? new Atom('"' + str + '"') : null /* dont compute for ATOM, infinite loops */;
                new Atom('"' + str + '"');

        this.commutative = commutative;
        this.levelMin = levelMin;


        this.subsMin = size.getOne();
        this.subsMax = size.getTwo();

        this.var = java.util.Set.of("%", "?", "$", "#").contains(str);
        varType = switch (str) {
            case "%" -> 0;
            case "?" -> 1;
            case "$" -> 2;
            case "#" -> 3;
            default -> -1;
        };

        boolean isImpl = "==>".equals(str);
        this.statement = "-->".equals(str) || isImpl || "<->".equals(str);
        boolean isConj = "&&".equals(str);
        this.temporal = isConj || isImpl;


        this.hasNumeric = temporal;


        this.bit = ("‡".equals(str)) ? 0 : (1 << ordinal()); //fragment and interval have 0 contributing structure

        this.atomic = var || java.util.Set.of(".", "+", "B", "/", "‡").contains(str);

        boolean isBool = "B".equals(str);
        boolean isInt = "+".equals(str);
        boolean isImg = "/".equals(str);
        boolean isInterval = "‡".equals(str);
        //boolean isSect = str.equals("|") || str.equals("&");

        conceptualizable = !var &&
                !isBool &&
                !isImg &&
                !isInterval &&
                (!isInt || NAL.term.INT_CONCEPTUALIZABLE)
        //!isNeg && //<- HACK technically NEG cant be conceptualized but in many cases this is assumed. so NEG must not be included in conceptualizable for it to work currently
        ;

        boolean isNeg = "--".equals(str);
        taskable = conceptualizable && !isInt && !isNeg;

        condable = taskable || isNeg || var || isInt;

        beliefable = taskable;
        goalable = taskable && !isImpl;

        set = "{".equals(str) || "[".equals(str);
    }

    public static boolean isAny(Term t, int struct) {
        return hasAny(struct, t.structOp());
    }

    public static boolean hasAny(int struct, Op o) {
        return hasAny(struct, o.bit);
    }

    public static boolean hasAny(int struct, int possiblyIncluded) {
        return (struct & possiblyIncluded) != 0;
    }

    public static boolean hasAll(int struct, int possiblyIncluded) {
        return ((struct | possiblyIncluded) == struct);
    }

    public static int or(Stream<Op> o) {
        return o.mapToInt(x -> x.bit).reduce(0, (a, b) -> a | b);
    }

    public static int or(Op... o) {
        assert(o.length > 0);
        int s = 0;
        for (Op x : o)
            s |= x.bit;
        return s;
    }

    public static @Nullable Op op(String s) {
        return stringToOp.get(s);
    }

    public static @Nullable Op op(Atom s) {
        return termToOp.get(s);
    }

    /**
     * encodes a structure vector as a human-readable target.
     * if only one bit is set then the Op's strAtom is used instead of the binary
     * representation.
     * TODO make an inverse decoder
     */
    public static Term strucTerm(int struct) {
        int bits = Integer.bitCount(struct);
        switch (bits) {
            case 0 -> throw new UnsupportedOperationException("no bits");
            case 1 -> {
                int x = Integer.highestOneBit(struct);
                return op(x <= 0 ?
                        0 : (int)Math.floor(Math.log(x) / Math.log(2))).atom;
            }
            default -> {
                return $.quote(Integer.toBinaryString(struct)/*.substring(Op.ops.length)*/);
            }
        }
    }

    public static boolean has(int haystack, int needle, boolean allOrAny) {
        return allOrAny ? hasAll(haystack, needle) : hasAny(haystack, needle);
    }

    public static Term DISJ(int dt, Term... x) {
        return DISJ(terms, dt, x);
    }

    public static Term DISJ(TermBuilder b, Term... x) {
        return DISJ(b, DTERNAL, x);
    }

    /**
     * build disjunction (consisting of negated conjunction of the negated subterms, ie. de morgan's boolean law )
     */
    public static Term DISJ(TermBuilder b, int dt, Term... x) {
        return switch (x.length) {
            case 0 -> True;
            case 1 -> x[0];
            default -> b.conj(dt, $.neg(x.clone())).neg();
        };
    }

    public static Term DISJ(Term... x) {
        return DISJ(terms, DTERNAL, x);
    }

    public static Stream<Op> all() {
        return Stream.of(ops);
    }

    public static Op op(int id) {
        return ops[id];
    }

    public static Atomic punc(byte p) {
        return switch (p) {
            case BELIEF -> Task.BeliefAtom;
            case QUESTION -> Task.QuestionAtom;
            case GOAL -> Task.GoalAtom;
            case QUEST -> Task.QuestAtom;
            case COMMAND -> Task.CommandAtom;
            default -> throw new UnsupportedOperationException();
        };

    }

    public static Task believe(Term x) {
        return new AbstractCommandTask($.func(Task.BeliefAtom, x));
    }

    public static Task ask(Term x) {
        return new AbstractCommandTask($.func(Task.QuestionAtom, x));
    }

    public static Task want(Term x) {
        return new AbstractCommandTask($.func(Task.GoalAtom, x));
    }

    public static Task how(Term x) {
        return new AbstractCommandTask($.func(Task.QuestAtom, x));
    }

    /** counts # of bits different in 2 structure vectors */
    public static int different(int aStruct, int bStruct) {
        return Integer.bitCount(aStruct ^ bStruct);
    }


    public static boolean dtSpecial(int dt) {
        return dt != DTERNAL && dt != XTERNAL;
    }

    /**
     * true if there is at least some type of structure in common
     */
    public static boolean hasCommon(Termlike x, Termlike y) {
        return x == y || hasCommon(x.struct(), y);
    }

    public static boolean hasCommon(int xStructure, Termlike y) {
        return hasCommon(xStructure, y.struct());
    }

    public static boolean hasCommon(int xStruct, int yStruct) {
        return ((xStruct & yStruct) != 0);
    }

    public static String structureString(int structure) {
        return String.format("%16s",
                strucTerm(structure))
                .replace(" ", "0");
    }


    public static boolean QUESTION_OR_QUEST(byte c) {
        return c == QUESTION || c == QUEST;
    }

    public static boolean BELIEF_OR_GOAL(byte c) {
        return c == BELIEF || c == GOAL;
    }

    @SafeVarargs public final <X> Term map(Function<X, Term> f, X... src) {
        return the(Util.map(f, new Term[src.length], src));
    }

    @Override
    public String toString() {
        return str;
    }

    /**
     * writes this operator to a Writer in (human-readable) expanded UTF16 mode
     */
    public final void append(Compound c, Appendable w) throws IOException {
        append(c.dt(), w, false);
    }

    /**
     * writes this operator to a Writer in (human-readable) expanded UTF16 mode
     */
    public final void append(int dt, Appendable w, boolean invertDT) throws IOException {


        if (dt == 0) {
            w.append(switch (this) {
                case CONJ -> ("&|");
                case IMPL -> ("=|>");
                default -> throw new UnsupportedOperationException();
            });
            return;
        }

        boolean hasTime = dt != DTERNAL;
        if (hasTime)
            w.append(' ');

        char ch = this.ch;
        if (ch == 0)
            w.append(str);
        else
            w.append(ch);

        if (hasTime) {

            if (invertDT)
                dt = -dt;

            if (dt > 0)
                w.append('+');

            if (dt == XTERNAL)
                w.append('-');
            else
                w.append(Integer.toString(dt));

            w.append(' ');

        }
    }
    public final Term the(Subterms s) {
        return the(DTERNAL, s);
    }

    public final Term the(Term... u) {
        return the(DTERNAL, u);
    }

    public final Term the(Term onlySubterm) {
        return the(DTERNAL, onlySubterm);
    }

    public final Term the(Collection<? extends Term> sub) {
        return the(DTERNAL, sub);
    }

    public final Term the(int dt, Collection<? extends Term> sub) {
        return the(dt, sub.toArray(EmptyTermArray));
    }

    public final Term the(Term a, int dt, Term b) {
        return the(dt, a, b);
    }

    public final Term the(int dt, Term... u) {
        return build(terms, dt, u);
    }

    public final Term the(int dt, Subterms s) {
        return build(terms, dt, s);
    }

    public final Term build(TermBuilder B, Collection<? extends Term> sub) {
        return build(B, DTERNAL, sub.toArray(EmptyTermArray));
    }

    public final Term build(TermBuilder B, Term... u) {
        return build(B, DTERNAL, u);
    }

    public final Term build(TermBuilder B, Subterms u) {
        return build(B, DTERNAL, u);
    }

    public Term build(TermBuilder B, int dt, Subterms u) {
        return build(B, dt, array(u));
    }

    public Term build(TermBuilder B, int dt, Term... u) {
        return B.compound(this, dt, commutative, u);
    }

    public static final ObjectIntPair<Term>[] EmptyTermIntPairArray = new ObjectIntPair[]{};

    public boolean isAny(int bits) {
        return ((bit & bits) != 0);
    }

    enum Args {
        ;
        static final IntIntPair Zero = pair(0, 0);
        static final IntIntPair One = pair(1, 1);
        static final IntIntPair Two = pair(2, 2);

        static final IntIntPair GTEZero = pair(0, NAL.term.SUBTERMS_MAX);
        static final IntIntPair GTEOne = pair(1, NAL.term.SUBTERMS_MAX);
        static final IntIntPair GTETwo = pair(2, NAL.term.SUBTERMS_MAX);

    }

    public static class InvalidPunctuationException extends RuntimeException {
        public InvalidPunctuationException(byte c) {
            super("Invalid punctuation: " + c);
        }
    }

}