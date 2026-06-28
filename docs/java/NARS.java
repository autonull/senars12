package nars;

import jcog.Log;
import jcog.Str;
import jcog.data.map.UnifriedMap;
import jcog.util.ArrayUtil;
import nars.action.decompose.*;
import nars.action.link.STMLinker;
import nars.action.link.TermLinking;
import nars.action.link.index.BagAdjacentTerms;
import nars.action.resolve.BeliefResolve;
import nars.action.transform.*;
import nars.concept.util.ConceptBuilder;
import nars.concept.util.DefaultConceptBuilder;
import nars.deriver.impl.TaskBagDeriver;
import nars.deriver.reaction.ReactionModel;
import nars.deriver.reaction.Reactions;
import nars.eval.Evaluation;
import nars.focus.time.FocusTiming;
import nars.focus.time.TaskWhen;
import nars.func.*;
import nars.memory.CaffeineMemory;
import nars.memory.Memory;
import nars.memory.SimpleMemory;
import nars.premise.NALPremise;
import nars.subterm.Subterms;
import nars.term.Compound;
import nars.term.Functor;
import nars.term.Termed;
import nars.term.atom.Atom;
import nars.term.atom.Bool;
import nars.term.atom.Int;
import nars.term.functor.AbstractInlineFunctor;
import nars.term.functor.AbstractInlineFunctor1;
import nars.term.functor.AbstractInlineFunctor2;
import nars.term.functor.LambdaFunctor;
import nars.term.obj.QuantityTerm;
import nars.term.util.Image;
import nars.term.util.Terms;
import nars.term.util.conj.Cond;
import nars.term.util.conj.CondDiff;
import nars.term.util.conj.ConjList;
import nars.term.util.transform.InstantFunctor;
import nars.term.util.var.DepIndepVarIntroduction;
import nars.term.var.Variable;
import nars.time.Tense;
import nars.time.Time;
import nars.time.clock.CycleTime;
import nars.time.clock.RealTime;
import org.jetbrains.annotations.Nullable;
import org.slf4j.Logger;

import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.IntStream;

import static nars.NAL.temporal.*;
import static nars.Op.*;
import static nars.action.resolve.Answerer.AnyTaskResolver;
import static nars.term.Functor.f0;
import static nars.term.atom.Bool.*;
import static nars.term.util.Image.imageNormalize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

/**
 * NAR builder
 */
public class NARS {

    public static final Logger log = Log.log(NARS.class);

    protected Supplier<Memory> index;

    protected Time time;

    @Deprecated protected final Function<Term, Focus> focus;

    protected Supplier<Random> rng;

    protected Supplier<ConceptBuilder> conceptBuilder;

    public final NAR get(Consumer<NAR> init) {
        var n = get();
        init.accept(n);
        return n;
    }

    public final NAR get() {
        var n = new NAR(
            index.get(),
            time,
            rng,
            conceptBuilder.get()
        );

        var self = n.self();

        n.add(n.main = focus.apply(self)); //HACK

        if (log.isInfoEnabled()) log.info("init {} {}", self, System.identityHashCode(n));

        step.forEach((a,p)->{
            log.debug("+ {} {}", self, a);
            p.accept(n);
        });
        return n;
    }

    /**
     * applied in sequence as final step before returning the NAR
     */
    private final Map<String,Consumer<NAR>> step = new LinkedHashMap<>();

    public NARS memory(Memory concepts) {
        this.index = () -> concepts;
        return this;
    }

    public NARS time(Time time) {
        this.time = time;
        return this;
    }

    public NARS concepts(ConceptBuilder cb) {
        this.conceptBuilder = () -> cb;
        return this;
    }

    /**
     * adds a deriver with the standard rules for the given range (inclusive) of NAL levels
     */
    @Deprecated public NARS withNAL(int minLevel, int maxLevel, String... extra) {
        return then("nal", n -> deriver(Rules.nal(
                minLevel, maxLevel, extra).core().stm().temporalInduction(), n)
            .everyCycle(n.main()));
    }

    public Deriver deriver(Reactions m, NAR n) {
        return deriver(m.compile(n), n);
    }

    protected Deriver deriver(ReactionModel m, NAR n) {
        return new TaskBagDeriver(m, n);
        //return new QueueDeriver(m, n);
        //return new FairDeriver(m, n);
        //return new SerialDeriver(m, n);
        //return new CachedSerialDeriver(m, n, 8 * 1024);
        //return new EqualizerDeriver(m, n);
        //return new MixDeriver(m, n);
    }

    /**
     * generic defaults
     */
    @Deprecated
    public static class DefaultNAR extends NARS {

        public DefaultNAR(int nal, boolean threadSafe) {
            this(0, nal, threadSafe);
        }

        public DefaultNAR(int nalMin, int nalMax, boolean threadSafe) {
            super();
            assert(nalMin <= nalMax);

            if (threadSafe)
                index = () -> new CaffeineMemory(64 * 1024);

            if (nalMax > 0)
                withNAL(nalMin, nalMax);

            then("misc", n-> n.complexMax.set(16));
        }

    }



    public NARS() {

        index = () ->
            new SimpleMemory(1 * 1024)
        ;

        time = new CycleTime();

        focus = w -> new Focus(w, 64);

        rng = ThreadLocalRandom::current;

        conceptBuilder = DefaultConceptBuilder::new;
    }

    /**
     * temporary, disposable NAR. safe for single-thread access only.
     * full NAL8 with STM Linkage
     */
    public static NAR tmp() {
        return tmp(8);
    }


    /**
     * temporary, disposable NAR. useful for unit tests or embedded components
     * safe for single-thread access only.
     *
     * @param nal adjustable NAL level. level >= 7 include STM (short-target-memory) Linkage plugin
     */
    public static NAR tmp(int nal) {
        return tmp(0, nal);
    }

    public static NAR tmp(int nalStart, int nalEnd) {
        return new DefaultNAR(nalStart, nalEnd, false).get();
    }

    /**
     * single thread but for multithread usage:
     * unbounded soft reference index
     */
    @Deprecated public static NAR threadSafe() {
        return threadSafe(8);
    }

    @Deprecated private static NAR threadSafe(int level) {
        var d = new DefaultNAR(level, true)
                .time(new RealTime.CS().durFPS(25.0f));

        d.rng = ThreadLocalRandom::current;

        return d.get();
    }


    /** @param durFPS milliseconds realtime.  <=0: infinite */
    public static NARS realtime(float durFPS) {
        NARS d = new DefaultNAR(0, true);
        return durFPS > 0 ? d.time(new RealTime.MS().durFPS(durFPS)) : d;
    }

    /**
     * provides only low level functionality.
     * an empty deriver, but allows any kind of target
     */
    public static NAR shell() {
        return tmp(0);
    }


    public NARS then(String what ,Consumer<NAR> action) {
        step.put(what, action);
        return this;
    }

    /**
     * Built-in Functors, Operators, etc.
     *
     * registered into a NAR on initialization
     * Provides the standard core function library
     * <p>
     * see:
     * https:
     */
    public enum Functors {
        ;

        public static final Functor[] statik = {

                Cmp.cmp,

                MathFunc.add,
                MathFunc.mul,
                MathFunc.div,
                MathFunc.pow,

                MathFunc.mod,
                MathFunc.max,
                MathFunc.min,
    //            MathFunc.lte,
    //            MathFunc.gte,
    //            MathFunc.lt,
    //            MathFunc.gt,

                //MathFunc.xor,

                Member.member,

                Replace.replace,


                SetFunc.intersect,
                SetFunc.differ,
                SetFunc.union,


                ListFunc.append,
                ListFunc.reverse,
                ListFunc.sub,
                ListFunc.subs,

                new AbstractInlineFunctor2("noEvent") {
                    @Override protected Term apply(Term c, Term e) {
                        return c.equals(e) ||
                                c instanceof Compound C && C.condOf(e) ? Null : c;
                    }
                },
                new AbstractInlineFunctor2("noEventPN") {
                    @Override protected Term apply(Term c, Term e) {
                        return c.equalsPN(e) ||
                                (c instanceof Compound C) && C.condOf(e, 0) ? Null : c;
                    }
                },

                new AbstractInlineFunctor1.AbstractInstantFunctor1("unneg") {
                    @Override
                    protected Term apply1(Term x) {
                        return x.unneg();
                    }
                },

                new AbstractInlineFunctor1.AbstractInstantFunctor1("imageNormalize") {
                    @Override
                    protected Term apply1(Term x) {
                        return imageNormalize(x);
                    }
                },

                Functor.f2Inline("imageInt", Image::imageInt),
                Functor.f2Inline("imageExt", Image::imageExt),


                new AbstractInlineFunctor2("eventOf") {
                    @Override
                    protected Term apply(Term conj, Term event) {
                        return conj instanceof Compound C && C.condOf(event) ? True : False;
                    }
                },

                /** removes one matching event, chosen at random  */
                new AbstractInlineFunctor2(atom("condWithoutAny")) {
                    @Override
                    @Deprecated protected Term apply(Term conj, Term event) {
                        return CondDiff.diffAny(conj, event, false);
                    }
                },

                /** removes one matching event, chosen at random, pos or negated */
                new AbstractInlineFunctor2(atom("condWithoutAnyPN")) {
                    @Override
                    @Deprecated protected Term apply(Term conj, Term event) {
                        return CondDiff.diffAny(conj, event, true);
                    }
                },
                new AbstractInlineFunctor2(atom("condIntersect")) {
                    @Override
                    @Deprecated protected Term apply(Term x, Term y) {
                        return Cond.intersect(x,y);
                    }
                },

                /** removes all matching events */
                new AbstractInlineFunctor2(atom("conjWithoutFirst")) {
                    @Override
                    protected Term apply(Term conj, Term event) {
                        return CondDiff.diffFirst(conj, event);
                    }
                },
                new AbstractInlineFunctor2(atom("conjWithoutFirstPN")) {
                    @Override
                    protected Term apply(Term conj, Term event) {
                        return CondDiff.diffFirstPN(conj, event);
                    }
                },
                new AbstractInlineFunctor2(atom("condWithoutAll")) {
                    @Override
                    protected Term apply(Term conj, Term event) {
                        return CondDiff.diffAll(conj, event);
                    }
                },

                /** removes all matching events, pos or negated */
                new AbstractInlineFunctor2(atom("condWithoutAllPN")) {
                    @Override
                    protected Term apply(Term conj, Term event) {
                        return CondDiff.diffAllPN(conj, event);
                    }
                },

    //            new AbstractInlineFunctor1("conjWithoutIndepEvents") {
    //                @Override
    //                protected Term apply1(Term conj) {
    //                    if (!conj.CONJ() || !conj.hasAny(VAR_INDEP)) return conj;//unchanged
    //                    ConjList c = new ConjList();
    //                    boolean xternal = conj.dt() == XTERNAL;
    //                    ((Compound) conj).events((when, what) -> {
    //                        if (!what.hasAny(VAR_INDEP))
    //                            c.add(when, what);
    //                    }, xternal ? TIMELESS : 0, true, xternal);
    //                    return c.term();
    //                }
    //            },

                /** applies the changes in structurally similar terms "from" and "to" to the target target */
                Functor.f3((Atom) $.atomic("replaceDiff"), (target, from, to) -> {
                    if (from.equals(to))
                        return Null;

                    int n;
                    if (from.opID() == to.opID() && (n = from.subs()) == to.subs()) {

                        Map<Term, Term> m = null;
                        for (var i = 0; i < n; i++) {
                            Term f = from.sub(i), t = to.sub(i);
                            if (!f.equals(t)) {
                                if (m == null) m = new UnifriedMap<>(1);
                                m.put(f, t);
                            }
                        }
                        if (m != null) {
                            var y = target.replace(m);
                            if (y != null && !y.equals(target))
                                return y;
                        }
                    }
                    return Null;
                }),

                /** similar to C/Java "indexOf" but returns a set of all numeric indices where the 2nd argument occurrs as a subterm of the first
                 *  if not present, returns Null
                 * */

                Functor.f2("indicesOf", (x, y) -> {


                    var s = x.subs();
                    if (s > 0) {
                        TreeSet<Term> indices = null;
                        for (var i = 0; i < s; i++) {
                            if (x.sub(i).equals(y)) {
                                if (indices == null) indices = new TreeSet<>();
                                indices.add(Int.i(i));
                            }
                        }
                        return indices == null ? Null : SETe.the(indices);
                    }
                    return Null;
                }),
                Functor.f2("keyValues", (x, y) -> {


                    var s = x.subs();
                    if (s > 0) {
                        TreeSet<Term> indices = null;
                        for (var i = 0; i < s; i++) {
                            if (x.sub(i).equals(y)) {
                                if (indices == null) indices = new TreeSet<>();
                                indices.add($.p(y, Int.i(i)));
                            }
                        }
                        if (indices == null)
                            return Null;
                        else {
                            return switch (indices.size()) {
                                case 0 -> Null;
                                case 1 -> indices.first();
                                default -> SETe.the(indices);
                            };
                        }
                    }
                    return Null;
                }),

                Functor.f2("varMask", (x, y) -> {
                    var s = x.subs();
                    if (s > 0) {
                        var t = IntStream.range(0, s).mapToObj(i -> x.sub(i).equals(y) ? y : $.varDep("z" + i)).toArray(Term[]::new);
                        return $.p(t);
                    }
                    return Null;
                }),


                Functor.f1Const("reflect", reflect::reflect),


                Functor.f1Const("toString", x -> $.quote(x.toString())),
                Functor.f1Const("toChars", x -> $.p(x.toString().toCharArray(), $::the)),
                Functor.f1Const("complexity", x -> $.the(x.complexity())),

                flat.flatProduct,

                Functor.f2("similaritree", (a, b) ->
                        a instanceof Variable || b instanceof Variable ? null :
                                $.the(Str.levenshteinDistance(a.toString(), b.toString()))
                ),



                Functor.f2("ifThen", (condition, conseq) -> {
                    if (!condition.equals(True)) {
                        if (condition == Null)
                            return Null;
                        return null;
                    } else
                        return conseq;
                }),

                Functor.f3("ifThenElse", (condition, ifTrue, ifFalse) -> {
                    if (!(condition instanceof Bool))
                        return null;
                    if (condition == True)
                        return ifTrue;
                    if (condition == False)
                        return ifFalse;

                    return Null;
                }),

                Functor.f3("ifOrElse", (condition, conseqTrue, conseqFalse) -> {
                    if (condition.hasVars())
                        return null;
                    if (condition.equals(True))
                        return conseqTrue;
                    if (condition.equals(False))
                        return conseqFalse;

                    return Null;
                }),

                Functor.f2("ifNeqRoot", (returned, compareTo) ->
                        returned.equalsRoot(compareTo) ? Null : returned
                ),


                Functor.f2("subterm", (x, index) -> {
                    try {
                        if (index.INT())
                            return x.sub($.intValue(index));
                    } catch (NumberFormatException ignored) {
                    }
                    return null;
                }),

                Functor.f1Inline("quote", x -> x),

                Functor.f1Inline("condLatest", (Term x) -> {
                    if (!x.SEQ())
                        return x;

                    try (var e = ConjList.conds(x, false, false)) {
                        var l = e.whenLatest();
                        e.removeIf((w, z) -> w != l);
                        return e.term();
                    }
                }),

                /** warning: this returns Null if unchanged */
                new AbstractInlineFunctor2("withoutPN") {
                    @Override
                    protected Term apply(Term container, Term _content) {
                        var content = _content.unneg();
                        var y = Terms.withoutAll(container, content::equalsPN);
                        return y == null || y.equals(container) ? Null : y;
                    }
                },

                /** warning: this returns Null if unchanged */
                new AbstractInlineFunctor1("negateConds") {
                    @Override protected Term apply1(Term x) {
                        return Cond.negateConds(x,
                            true
                            //!x.SEQ()
                            //false
                        );
                    }
                },

                /** warning: this returns Null if unchanged */
                new AbstractInlineFunctor2("without") {
                    @Override
                    protected Term apply(Term container, Term content) {
                        var y = Terms.withoutAll(container, content::equals);
                        return y == null || y.equals(container) ? Null : y;
                    }
                },

                /** warning: this returns Null if unchanged */
                new AbstractInlineFunctor2("unsect") {
                    @Override
                    protected Term apply(Term container, Term content) {
                        var y = Terms.withoutAll(container, content.CONJ() ? ((Compound) content).contains(false, false) : content::equals);
                        return y == null || y.equals(container) ? Null : y;
                    }
                },

                Functor.f("slice", args -> {
                    if (args.subs() != 2)
                        return null;

                    var x = args.sub(0);
                    if (x.subs() > 0) {
                        var len = x.subs();

                        var index = args.sub(1);
                        var o = index.op();
                        if (o == INT) {

                            var i = Int.i(index);
                            return i >= 0 && i < len ? x.sub(i) : False;

                        } else if (o == PROD && index.subs() == 2) {
                            var start = index.sub(0);
                            if (start.INT()) {
                                var end = index.sub(1);
                                if (end.INT()) {
                                    var si = Int.i(start);
                                    if (si >= 0 && si < len) {
                                        var ei = Int.i(end);
                                        if (ei >= 0 && ei <= len) {
                                            if (si == ei)
                                                return EmptyProduct;
                                            if (si < ei) {
                                                return $.p(Arrays.copyOfRange(x.subterms().arrayClone(), si, ei));
                                            }
                                        }
                                    }

                                    return False;
                                }
                            }

                        }
                    }
                    return null;
                })
        };

    //    private static Term nullIfEq(Term mustNotEqual, Term result) {
    //        return mustNotEqual.equals(result) ? Null : result;
    //    }

        private static final Map<Term, Functor> statiks;

        static {
            var s = new UnifriedMap<Term, Functor>(statik.length);
            for (var f : statik) s.put(f.term(), f);
            s.trimToSize();
            statiks = s;
        }

        public static @Nullable Functor functor(Term x) {
            return statiks.get(x);
        }

        private static void registerFunctorsStatic(NAR nar) {
            for (var t : statik)
                nar.add(t);
        }

        /**
         * instantiates NAR-local functors
         */
        private static void registerFunctorsDynamic(NAR nar) {
            nar.add(SetFunc.sort());

            /** dynamic target builder - useful for NAR specific contexts like clock etc.. */
            nar.add(new TermDynamic(nar));

            /** applies # dep and $ indep variable introduction if possible. returns the input term otherwise  */
            nar.add(Functor.f1Inline("varIntro", x -> {
                if (!(x instanceof Compound c)) return Null;
                var result = DepIndepVarIntroduction.the.apply(c, nar.random(), null);
                return result != null ? result : Null;
            }));

    /** TODO
             * replay(timeStart, timeEnd, [belief|goal|question] [pos|neg]) [!;]
             * functor context parameter to subsume Operator API as functors that trigger
             * async reactions when evaluated in imperative contexts
             */
            nar.add(new AbstractInlineFunctor2("replay") {

                @Override
                protected Term apply(Term a, Term b) {
                    return null;
                }
            });


            nar.add(f1Table("beliefTruth", nar, BELIEF, (c, n) -> {
                var when = n.time();
                return $.quote(((BeliefTable) c).truth(when, when, n));
            }));
    //        nar.on(Functor.f1Concept("goalTruth", nar, (c, n) -> $.quote(n.goal(c, n.time()))));

            nar.add(f0("self", nar::self));

            nar.add(Functor.f1("the", what -> {


                if (what instanceof Atom) {
                    switch (what.toString()) {
                        case "sys" -> {
                            return $.p(
                                    $.quote(nar.emotion.summary()),
                                    $.quote(nar.memory.summary()),
                                    $.quote(nar.emotion.summary()),
                                    $.quote(nar.exe.toString())
                            );
                        }
                    }
                }

                Termed x = nar.concept(what);
                if (x == null)
                    x = what;

                return $.quote($.p($.quote(x.getClass().toString()), $.quote(x.toString())));
            }));


        }

        private static void registerOperators(NAR nar) {

            nar.add(atom("task"), (x, nn) -> {
                //TODO punctuation parameter: Task.BeliefAtom, Task.GoalAtom etc
                var t = NALTask.taskEternal(x.term().sub(0).sub(0), BELIEF, $.t(1.0f, nn.confDefault(BELIEF)), nn);
                t.withPri(nn.priDefault(BELIEF));
                nn.input(t);
                return null;
            });

            nar.addOp1("assertTrue", (x, nn) -> {
                if (x.hasVars()) //???
                    assertSame(True, x);
            });

            //TODO separate into assert and equals functors
            nar.addOp2("assertEquals", (x, y, nn) -> {
                if (!x.equals(y) && !x.hasVars() && !y.hasVars())
                    assertEquals(/*msg,*/ x, y);
            });

        }


        public static void init(NAR nar) {
            registerFunctorsStatic(nar);
            registerFunctorsDynamic(nar);
            registerOperators(nar);
        }

        public static LambdaFunctor f1Table(String termAtom, NAR nar, byte punc, BiFunction<TaskTable, NAR, Term> ff) {
            assert punc == BELIEF || punc == GOAL;
            var beliefOrGoal = punc == BELIEF;
            return Functor.f1(atom(termAtom), t -> {
                TaskTable c = nar.table(t, beliefOrGoal);
                return c != null ? ff.apply(c, nar) : null;
            });
        }

        private static final class TermDynamic extends AbstractInlineFunctor implements InstantFunctor<Evaluation> {

            private final NAR nar;

            TermDynamic(NAR nar) {
                super(TERM);
                this.nar = nar;
            }

            @Override
            public Term apply(Evaluation e, Subterms s) {
                var opTerm = s.sub(0);
                var o = Op.op((Atom) opTerm);
                if (o == null)
                    return Null; //TODO throw

                int dt;
                if (s.subs() == 3) {
                    if (!o.temporal)
                        throw new UnsupportedOperationException("unrecognized modifier argument: " + s);

                    var dtTerm = s.sub(2);
                    if (!(dtTerm instanceof QuantityTerm)) {
                        dtTerm = QuantityTerm.the(dtTerm);
                        if (dtTerm == null)
                            return Null;
                    }

                    dt = Tense.occToDT(nar.time.toCycles(((QuantityTerm) dtTerm).quant));

                } else
                    dt = DTERNAL;

                return o.the(dt, s.sub(1).subterms().arrayShared());
            }
        }


    }

    /**
     * utility class and recipes for building Deriver's
     *
     * half of it is patrick's original meta-NAL, which is whats in the .nal files.  the other half of the 'rules' aka reactions are natively coded.  both share a common predicate system that gets compiled into a tree of folded common preconditions for maximum elimination.
     *
     * these rules are triggered by matching properties against the current Premise in a Deriver.  the premise consists of, at minimum, a Term from() and optionally Term to(), NALTask fromTask(), NALTask toTask().  this allows all varieties of single and double premises.
     *
     * TaskLinks are the elemental Premise.  it derives single and double premises through a dynamic task lookup process that can be biased in different ways, for example, occurrence time (start.. end range).
     *
     * the various premise implementations can cache (memoize) data in them to accelerate if they are called again.
     *
     * the rates of generating the different 'daughter-product' premises in this chain reaction are individually controllable but seems that even if this is flat it can work with the careful choices of rules.
     *
     * in terms of forming new links in the graph search process, compound decomposition is a spiralling inwards.  and termlinking is a spiral outwards.  the priority rates of each of these can be seperately controlled too for different mental dynamics.
     */
    public static class Rules extends Reactions {

        private final TaskWhen when =
            new FocusTiming();
            //new MultiFocusTiming();
            //new JitterTiming(when),

        private static final boolean implTwoStep = false;

        public static final boolean beliefResolveAuto = false;

        final BeliefResolve beliefResolver = new BeliefResolve(
                true, true, true, true,
                when,
                AnyTaskResolver
        );

        public Rules core() {
            return core(true);
        }

        /**
         * standard derivation behaviors
         */
        public Rules core(boolean varIntro) {

            //add(new TaskResolve(when, AnyTaskResolver));

            //if (!beliefResolveAuto)
            add(beliefResolver);

            decomposers();

            termlinking();

            if (varIntro)
                varIntro();

            add(new Evaluate());

    //        addAll(
    //                new AnswerQuestionsFromBeliefTable(
    //                        new FocusTiming(),
    //                        true, true, AnyTaskResolver),
    //                new AnswerQuestionsFromConcepts.AnswerQuestionsFromTaskLinks(when)
    //                        //.log(true)
    //        );

            return this;
        }

        public Rules temporalInduction() {
            temporalInductionImpl(TEMPORAL_INDUCTION_IMPL_SUBJ_PN, TEMPORAL_INDUCTION_IMPL_BIDI);
            temporalInductionConj(false, TEMPORAL_INDUCTION_DISJ);
            return this;
        }

        /** standard ruleset */
        @Deprecated public static Rules nal(int minLevel, int maxLevel, String... extraFiles) {
            var r = new Rules();

            for (var level = minLevel; level <= maxLevel; level++) {
                switch (level) {
                    case 1 -> r.structural();
                    case 2 -> r.sets();
                    case 3,5,6 -> {
                        r.procedural();
                        r.analogy();
                    }
                }
            }

            r.files(extraFiles);

            return r;
        }

        /** TODO ensure called only once */
        public Rules structural() {
            files(
               "inh.nal"
                //,"inh.goal.nal"
                ,"sim.nal"
            );

            return this;
        }

        /** optional */
        public Rules images() {

            add(new ImageUnfold(true));

            add(new ImageAlign.ImageAlignBidi());

                //new ImageAlign.ImageAlignUni_Root()
    //			new ImageAlign.ImageAlignUni_InCompound(true),
    //			new ImageAlign.ImageAlignUni_InCompound(false),

            return this;
        }

        /** same */
        public Rules diff() {
            files(
                    "diff.nal"
                , "diff.goal.nal" //TODO needs updated if comparator model is used
            );
            return this;
        }

        public Rules sets() {
            files("set.compose.nal",
                    "set.decompose.nal",
                    "set.guess.nal");
            return this;
        }

        public Rules analogy() {
            files(
              "analogy.anonymous.conj.nal"
                  , "analogy.anonymous.impl.nal"
                  , "analogy.mutate.nal"
                    //,"analogy.goal.nal"
            );
            return this;
        }
        public Rules procedural() {

            files(
                    "cond.decompose.nal",

                    /* X!,  C.  |- before(C,X)! */        "cond.decompose.must.nal",
                    /* X!,  C.  |- afterOrDuring(C,X)! */ "cond.decompose.might.nal",

                    /* C!,  X.  |- afterOrDuring(C,X)! */ "cond.decompose.would.nal",

                    /* C/!, X.  |- before(C,X)!  */       "cond.decompose.wouldve.nal",

                    // /* C!,--X0. |- X0! */                 "cond.decompose.should.nal",

                    // /* C!,X0 |- X0! */ "cond.decompose.start.nal",

                    //"nal3.question.nal",

                    "contraposition.nal",
                    "conversion.nal",

                    "impl.syl.nal",
                    "impl.syl.cond.nal",
                    "impl.syl.combine.nal",

                    "impl.strong.nal",
                    "impl.strong.cond.nal",

                    "impl.compose.nal"
                    //,"impl.compose.specific.nal"

                  , "impl.decompose.self.nal"
                  //, "impl.decompose.subcond.nal"
                  , "impl.decompose.specific.nal"

                  , "impl.recompose.nal"

                  //, "impl.decompose.or.nal"

                  //,"impl.decompose.inner.nal"
                  //,"impl.decompose.inner.question.nal",


                    //,"quest_induction.nal"
                    //"equal.nal"
                    //"xor.nal"
                    //"impl.disj.nal"
                    //"nal6.layer2.nal"
                    //"nal6.mutex.nal"
            );
            return this;
        }

        private void varIntro() {
            add(
                new VariableIntroduction()./*anon().*/taskPunc(true,
                    NAL.derive.VARIABLE_INTRODUCE_GOALS,
                    NAL.derive.VARIABLE_INTRODUCE_QUESTIONS,
                    NAL.derive.VARIABLE_INTRODUCE_QUESTS)
            );
        }

        private void termlinking() {
            add(
                new TermLinking(new BagAdjacentTerms())
            );
        }

        public Rules stm() {
            add(new STMLinker(true, true, true, true));
            return this;
        }

        private void temporalInductionConj(boolean full, boolean disj) {
            if (!full) {
                //auto-negate
                add(new TemporalInduction.ConjInduction(0, 0));

                if (disj)
                    add(new TemporalInduction.DisjInduction(0, 0));
            } else {
                //disj = ignored

                addAll(
                      new TemporalInduction.ConjInduction(+1, +1)
                    , new TemporalInduction.ConjInduction(-1, +1)
                    , new TemporalInduction.ConjInduction(+1, -1)
                    , new TemporalInduction.ConjInduction(-1, -1)
                );

    //					.iff(  TheTask, TermMatcher.ConjSequence.the, false)
    //					.iff(TheBelief, TermMatcher.ConjSequence.the, false)
            }
        }

        private void temporalInductionImpl(boolean implBothSubjs, boolean bidi) {
            var implDir = bidi ? 0 : +1;
            if (implBothSubjs) {
                addAll(
                    new TemporalInduction.ImplInduction(+1, implDir),
                    new TemporalInduction.ImplInduction(-1, implDir)
                );
            } else {
                add(
                    new TemporalInduction.ImplInduction(2 /* AUTO-stochastic */, implDir)
                    //new TemporalInduction.ImplTemporalInduction(0 /* AUTO */, implDir)
                );
            }
        }


        private void decomposers() {

            /* may be necessary to be true for certain delta.goal.nal rules */
            var deltaDecompose =
                    true;
                    //false;

            var special = new Op[] { INH, SIM, IMPL, CONJ };

            addAll(
                //default compound decomposition
                new Decompose1().taskIsNot(
                    deltaDecompose ? special : ArrayUtil.add(special, DELTA)
                ),

                new DecomposeCond().bidi(AnyTaskResolver, when),

                new DecomposeStatement(INH, SIM)
            );

            if (implTwoStep) {
                addAll(
                    //2-step IMPL decompose (progressive - less combinatorial explosion)
                    new DecomposeImpl(false).bidi(AnyTaskResolver, when),
                    new DecomposeCondSubterm(IMPL, true)//.bidi(AnyTaskResolver, when)
                );
            } else {
                //1-step IMPL decompose (immediate)
                //add(new DecomposeImpl(true).bidi());

                addAll(
                    //new DecomposeImpl(true)
                    new DecomposeImpl(true).bidi(AnyTaskResolver, when)
                    //new DecomposeImpl(false).bidi()
                    //new DecomposeImpl(true), new DecomposeImpl(false).reverse()
                );
                //add(DecomposeTerm.either(
            }
        }

        @Override
        public ReactionModel compile(NAR n) {
            var m = super.compile(n);

            if (beliefResolveAuto) {
                m.premisePreProcessor = (x, d) -> {
                    if (x instanceof NALPremise.SingleTaskPremise s) {
                        if (s.task.BELIEF_OR_GOAL()) {
                            var y = beliefResolver.resolveBelief(s, d);
                            if (y != null)
                                return y;
                        }
                    }
                    return x;
                };
            }
            return m;
        }


    }
}