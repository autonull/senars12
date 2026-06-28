package nars;


import com.google.common.primitives.Longs;
import com.google.common.util.concurrent.MoreExecutors;
import jcog.Log;
import jcog.Str;
import jcog.Util;
import jcog.data.byt.DynBytes;
import jcog.data.map.ObjIntHashMap;
import jcog.event.ByteTopic;
import jcog.event.ListTopic;
import jcog.event.Off;
import jcog.exe.Cycled;
import jcog.exe.InstrumentedLoop;
import jcog.exe.Loop;
import jcog.exe.SchedExecutor;
import jcog.func.TriConsumer;
import jcog.signal.FloatRange;
import jcog.signal.meter.Metered;
import jcog.thing.Part;
import nars.Narsese.NarseseException;
import nars.concept.NodeConcept;
import nars.concept.Operator;
import nars.concept.PermanentConcept;
import nars.concept.TaskConcept;
import nars.concept.util.ConceptBuilder;
import nars.control.Causes;
import nars.control.Emotion;
import nars.control.Pausing;
import nars.eval.Evaluator;
import nars.focus.util.FocusBag;
import nars.focus.util.PriTree;
import nars.io.IO;
import nars.memory.Memory;
import nars.table.question.QuestionTable;
import nars.table.util.DynTables;
import nars.task.proxy.SpecialNegTask;
import nars.task.util.TaskException;
import nars.term.Compound;
import nars.term.Functor;
import nars.term.Neg;
import nars.term.Termed;
import nars.term.atom.Atom;
import nars.term.atom.Atomic;
import nars.term.util.TermTransformException;
import nars.time.Every;
import nars.time.ScheduledTask;
import nars.time.Tense;
import nars.time.Time;
import nars.time.event.WhenTimeIs;
import nars.time.part.DurLoop;
import nars.time.part.DurNARConsumer;
import nars.truth.proj.TruthProjection;
import nars.util.NARPart;
import org.HdrHistogram.Histogram;
import org.eclipse.collections.impl.map.mutable.primitive.ByteIntHashMap;
import org.jetbrains.annotations.Nullable;
import org.slf4j.Logger;

import java.io.*;
import java.net.URL;
import java.util.*;
import java.util.function.*;
import java.util.stream.Stream;
import java.util.zip.GZIPOutputStream;

import static nars.$.$;
import static nars.$.$$;
import static nars.Op.*;


/**
 * Non-Axiomatic Reasoner
 * <p>
 * Instances of this represent a reasoner connected to a Memory, and set of Input and Output channels.
 * <p>
 * All state is contained within   A NAR is responsible for managing I/O channels and executing
 * memory operations.  It executes a series sof cycles in two possible modes:
 * * step mode - controlled by an outside system, such as during debugging or testing
 * * thread mode - runs in a pausable closed-loop at a specific maximum framerate.
 */
public final class NAR extends NAL<NAR> implements Consumer<Task>, Cycled {
	/**
	 * id of this NAR's self; ie. its name
	 */
	private final Term self;
	private static final Logger logger = Log.log(NAR.class);
	public final Memory memory;
	/** TODO move conceptBuilder to field in Memory */
	public final ConceptBuilder conceptBuilder;


	public final SchedExecutor exe;

    public final NARLoop loop;

	public final Emotion emotion = new Emotion();

	public final Causes causes;
	public final PriTree pri;

	public final FocusBag focus;
	public final ListTopic<NAR> eventClear = new ListTopic<>(), eventCycle = new ListTopic<>();

	public final Evaluator evaluator =
		new Evaluator(this::axioms);
		//new CachedEvaluator(this::axioms, 64 * 1024 /* TODO tune */);

	public NAR(Memory m, Time t, Supplier<Random> rng, ConceptBuilder conceptBuilder) {
		super(t, rng);

		this.self = randomSelf();

		this.memory = m;

		(this.conceptBuilder = conceptBuilder).init(emotion, t);

		this.exe = new SchedExecutor(MoreExecutors.newDirectExecutorService());

		m.start(this);

		this.causes = new Causes();
		this.pri = new PriTree();
		this.focus = new FocusBag(128, this);

		onDur/*Cycle*/(emotion);
		onDur(pri::commit);

		NARS.Functors.init(this);

		this.loop = new NARLoop();

		//synch();
	}

	/** @param taskConceptOnly require concept that support tasks */
	@Nullable public Term conceptTerm(Termed X, boolean taskConceptOnly) {
		if (X instanceof Concept)
			return (taskConceptOnly && !(X instanceof TaskConcept)) ? null : X.term();

        var x = X.term();

		if (!NAL.term.CONCEPTUALIZE_OVER_VOLUME && x.complexity() > complexMax())
			return null;

        var z = x.concept();

		return taskConceptOnly && !NALTask.TASKS(z) ? null : z;
	}

	public static void proofPrint(NALTask t) {
		proofAppend(t, System.out);
	}

	public static void proofAppend(NALTask t, Appendable o) {
		try {
			o.append(t.proof()).append('\n');
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}

	/**
	 * dynamic axiom resolver
	 */
	public final Functor axioms(Atom term) {
		Termed x = concept(term);
		if (x instanceof NodeConcept.FunctorConcept)
			x = x.term();
		return x instanceof Functor f ? f : null;
	}


	/**
	 * creates a snapshot statistics object
	 * TODO extract a Method Object holding the snapshot stats with the instances created below as its fields
	 */
	public synchronized SortedMap<String, Object> stats(boolean concepts, boolean emotions) {
		SortedMap<String, Object> x = new TreeMap<>();

        var now = time();

		if (concepts) {
			var beliefs = new LongSummaryStatistics();
			var goals = new LongSummaryStatistics();
			var questions = new LongSummaryStatistics();
			var quests = new LongSummaryStatistics();


			var clazz = new ObjIntHashMap<Class>();
			var rootOp = new ByteIntHashMap();

			var volume = new Histogram(1, term.COMPOUND_VOLUME_MAX, 3);

			concepts()./*filter(xx -> !(xx instanceof Functor)).*/forEach(c -> {

                var ct = c.term();
				volume.recordValue(ct.complexity());
				rootOp.addToValue(ct.opID(), 1);
				clazz.increment(c.getClass());

				beliefs.accept(c.beliefs().taskCount());
				goals.accept(c.goals().taskCount());
				questions.accept(c.questions().taskCount());
				quests.accept(c.quests().taskCount());
			});


			if (loop.isRunning())
				loop.stats("loop", x);

			x.put("time", now);
			x.put("concept count", memory.size());

			x.put("belief count", (double) beliefs.getSum());
			x.put("goal count", (double) goals.getSum());

			rootOp.forEachKeyValue((opID, count) -> x.put("concept op " + op(opID), count));

			Str.histogramDecodeExact(volume, "concept volume", 4, x::put);

			//Util.toMap(clazz, "concept class", x::put);

			clazz.forEachKeyValue((c, count) -> {
				if (count > 1)
					x.put("concept class " + c, count);
				else {
					//TODO record unique implementation classes, or at least how many
				}
			});

		}

		if (emotions) {
			new Metered.MeterReader() {
				@Override public void set(Object value) {
					x.put(metric, value);
				}
			}.run(now, emotion.fields);
		}

		return x;

	}

	/**
	 * Reset the system with an empty memory and reset clock.  Event handlers
	 * will remain attached but enabled parts will have been deactivated and
	 * reactivated, a signal for them to empty their state (if necessary).
	 */
	@Deprecated
	public void reset() {

		synchronized (exe) {

            var running = loop.isRunning();
            var fps = running ? loop.fps() : -1;

			stop();

			clear();
			exe.clear();
			time.reset();

			if (running)
				loop.fps(fps);
		}

		logger.info("reset");

	}

	/**
	 * deallocate as completely as possible
	 */
	public void delete() {
		logger.debug("delete {}", self());
		synchronized (exe) {

			stop();

			focus.clear();

			//clear();
			memory.clear();

			super.delete();

			eventCycle.clear();
			eventClear.clear();

			exe.shutdownNow();
		}
	}

	/**
	 * the clear event is a signal indicating that any active memory or processes
	 * which would interfere with attention should be stopped and emptied.
	 * <p>
	 * this does not indicate the NAR has stopped or reset itself.
	 */
	@Deprecated
	public void clear() {
		logger.info("clear");
		eventClear.accept(this);
	}

	/**
	 * parses one and only task
	 */
	public final <T extends Task> T inputTask(String taskText) throws Narsese.NarseseException {
		T x = Narsese.task(taskText, this);
		input(x);
		return x;
	}

	public List<Task> input(String text) throws NarseseException, TaskException {
		var l = Narsese.tasks(text, this);
		switch (l.size()) {
			case 0 -> l = Collections.EMPTY_LIST;
			case 1 -> input(l.getFirst());
			default -> input(l);
		}
		return l;
	}

	/**
	 * gets a concept if it exists, or returns null if it does not
	 */
	public final @Nullable Concept conceptualize(String conceptTerm) throws NarseseException {
		return conceptualize($(conceptTerm));
	}


	public final void input(Task t) {
		main().accept(t);
	}

	@Override
	public final void accept(Task task) {
		input(task);
	}

	@Override
	public final @Nullable Term term(Part<NAR> p) {
		return ((NARPart) p).id;
	}

	public final boolean add(NARPart p) {
		/* HACK */
		if (p.nar!=this && p.nar!=null)
			throw new UnsupportedOperationException();

		p.nar = this;

		return add(p.id, p, true);
	}

	public final boolean add(NARPart p, boolean autoStart) {
		return add(p.id, p, autoStart);
	}

	public final void add(Functor f) {
		memory.set(f);
	}

	public final NARPart add(Class<? extends NARPart> p, boolean autoStart) {
		return add(null, p, autoStart);
	}

	public final NARPart add(Class<? extends NARPart> p) {
		return add(p, true);
	}

	public final NARPart add(@Nullable Term key, Class<? extends NARPart> p) {
		return add(key, p, true);
	}

	public final NARPart add(@Nullable Term key, Class<? extends NARPart> p, boolean autoStart) {
		NARPart pp = null;
		if (key != null)
			pp = (NARPart) parts.get(key);

		if (pp == null) {
			//HACK
			//TODO make sure this is atomic
			pp = build(p).get();
			if (key == null)
				key = pp.id;
			if (parts.get(key) == pp) {
				return pp; //already added in its constructor HACK
			}
		} else {
			if (p.isAssignableFrom(pp.getClass()))
				return pp; //ok
			else {
				remove(key);
			}
		}

		if (autoStart) {
            var ok = add(key, pp);
			assert ok;
		}
		return pp;
	}

	@Deprecated public final Functor addOp1(String atom, BiConsumer<Term, NAR> exe) {
		return add(Atomic.atom(atom), (task, nar) -> {
            var ss = task.term().sub(0).subterms();
			if (ss.subs() == 1)
				exe.accept(ss.sub(0), nar);
			return null;
		});
	}

	@Deprecated public final void addOp2(String atom, TriConsumer<Term, Term, NAR> exe) {
		add(Atomic.atom(atom), (task, nar) -> {
            var ss = task.term().sub(0).subterms();
			if (ss.subs() == 2)
				exe.accept(ss.sub(0), ss.sub(1), nar);
			return null;
		});
	}

	/**
	 * registers an operator
	 */
	public final Functor add(Atom name, BiFunction<Task, NAR, Task> exe) {
        var f = Operator.simple(name, exe);
		add(f);
		return f;
	}



	/**
	 * returns concept belief/goal truth evaluated at a given time
	 */
	public final @Nullable Truth truth(Termed concept, boolean beliefOrGoal, long start, long end, float dur) {
        var neg = concept instanceof Term && concept.term() instanceof Neg;
		if (neg)
			concept = ((Term)concept).unneg();

		@Nullable BeliefTable table = table(concept, beliefOrGoal);
		if (table != null) {
            var tt = table.truth(start, end, concept instanceof Term t ? t : concept.term(), null, dur, this);
			if (tt != null)
				return neg ? tt.neg() : tt;
		}
		return null;
	}

	@Deprecated public final @Nullable Truth beliefTruth(String concept, long when) throws NarseseException {
		return beliefTruth($(concept), when);
	}

	@Deprecated public final @Nullable Truth goalTruth(String concept, long when) throws NarseseException {
		return goalTruth($(concept), when);
	}

	@Deprecated public final @Nullable Truth beliefTruth(Termed concept, long when) {
		return beliefTruth(concept, when, when);
	}

	@Deprecated public final @Nullable Truth beliefTruth(Termed concept, long start, long end) {
		return beliefTruth(concept, start, end, 0);
	}
	@Deprecated public final @Nullable Truth goalTruth(Termed concept, long when) {
		return goalTruth(concept, when, when);
	}

	@Deprecated public final @Nullable Truth goalTruth(Termed concept, long start, long end) {
		return goalTruth(concept, start, end, 0);
	}
	public final @Nullable Truth beliefTruth(Termed concept, long start, long end, float dur) {
		return truth(concept, true, start, end, dur);
	}
	public final @Nullable Truth goalTruth(Termed concept, long start, long end, float dur) {
		return truth(concept, false, start, end, dur);
	}

	/**
	 * Exits an iteration loop if running
	 */
	public final NAR stop() {

		loop.stop();

		synchronized (exe) {
			synch();
		}

		return this;
	}

	public final void pause() {
		loop.stop();
	}

	/**
	 * the current context's eventTask
	 */
	@Deprecated
	public final ByteTopic<Task> eventTask() {
		return main().eventTask;
	}

	public AutoCloseable log() {
		return main().log();
	}

	public AutoCloseable log(Appendable out) {
		return main().logTo(out, null);
	}

	/**
	 * Runs until stopped, at a given delay period between frames (0= no delay). Main loop
	 *
	 * @param periodMS in milliseconds
	 */
	@Override
	public final NARLoop startPeriodMS(int periodMS) {
		loop.startPeriodMS(periodMS);
		return loop;
	}

	@Override
	public void run() {
		synchronized (loop) {
//			loop.setAsync(false);
			loop.next();
		}
	}

	public NAR input(String... ss) throws NarseseException {
		for (var s : ss)
			input(s);
		return this;
	}

	public NAR inputNarsese(URL url) throws IOException, NarseseException {
		try (var s = url.openStream()) {
			return inputNarsese(s);
		}
	}

	public NAR inputNarsese(InputStream inputStream) throws IOException, NarseseException {
		input(new String(inputStream.readAllBytes()));
		return this;
	}

	@Deprecated
	public NAR inputAt(long time, String... tt) {

		runAt(time, nn -> {
			//nn.input(yy.toArray(new Task[size]))
			try {
				nn.input(tt);
			} catch (NarseseException e) {
				e.printStackTrace();
			}
		});

		return this;
	}

	/**
	 * TODO use a scheduling using r-tree
	 */
	public void inputAt(long when, Task... x) {
		runAt(when, nn -> main().acceptAll(x));
	}

	public final void runAt(long whenOrAfter, Consumer<NAR> t) {
		if (time() >= whenOrAfter)
			t.accept(this);
		else
			runAt(WhenTimeIs.then(whenOrAfter, t));
	}

	/**
	 * schedule a task to be executed no sooner than a given NAR time
	 *
	 * @return
	 */
	public final ScheduledTask runAt(long whenOrAfter, Runnable t) {
		return runAt(WhenTimeIs.then(whenOrAfter, t));
	}

	public final ScheduledTask runAt(ScheduledTask t) {
		exe.runAt(()->t.accept(this), t.next);
		return t;
	}

	public final void runLater(Runnable t) {
		runAt(WhenTimeIs.then(time(), t));
	}

	/**
	 * the tasks in concepts
	 */
	public Stream<NALTask> tasks(boolean beliefs, boolean questions,
							  boolean goals, boolean quests) {
		return concepts().flatMap(c ->
			c.tasks(beliefs, questions, goals, quests));
	}

	public void tasks(boolean includeConceptBeliefs, boolean includeConceptQuestions, boolean includeConceptGoals,
					  boolean includeConceptQuests, BiConsumer<Concept, Task> each) {
		concepts().forEach(c ->
			c.tasks(includeConceptBeliefs,
				includeConceptQuestions,
				includeConceptGoals,
				includeConceptQuests).forEach(t -> each.accept(c, t))
		);
	}

	public Stream<NALTask> tasks() {
		return tasks(true, true, true, true);
	}

	/**
	 * resolves a target or concept to its currrent Concept
	 */
	public final @Nullable Concept concept(Termed x) {
		return concept(x, false);
	}

	public final @Nullable TaskConcept concept(NALTask x) {
		return (TaskConcept)concept((Termed)x);
	}
	public final @Nullable TaskConcept conceptualize(NALTask x) {
		return (TaskConcept)conceptualize((Termed)x);
	}

	public final @Nullable Concept concept(String term) {
		return concept($$(term), false);
	}

	/**
	 * resolves a target to its Concept; if it doesnt exist, its construction will be attempted
	 */
	public final @Nullable Concept conceptualize(/**/ Termed termed) {
		return concept(termed, true);
	}

	public final @Nullable Concept concept(Termed _x, boolean createIfMissing) {
        return _x instanceof Concept xConcept && memory.elideConceptGets() && !xConcept.isDeleted() ?
			xConcept :
			_conceptualize(conceptTerm(_x, false), createIfMissing);
	}

	private Concept _conceptualize(@Nullable Term x, boolean createIfMissing) {
		return x!=null ? memory.get(x, createIfMissing) : null;
	}

	public final Stream<Concept> concepts() {
		return memory.stream();
	}

	/**
	 * a frame batches a burst of multiple cycles, for coordinating with external systems in which multiple cycles
	 * must be run per control frame.
	 */
	public final Off onCycle(Consumer<NAR> each) {
		return eventCycle.on(each);
	}

	public final Off onCycle(Runnable each) {
		return onCycle(ignored -> each.run());
	}

	public final DurLoop onDur(Runnable on, float durPeriod) {
		return onDur(on).durs(durPeriod);
	}

	public final DurLoop onDur(Runnable on) {
		var r = new DurLoop.DurRunnable(on);
		add(r);
		return r;
	}

	public final DurLoop onDur(Consumer<NAR> on) {
        var r = new DurNARConsumer(on);
		add(r);
		return r;
	}

	/**
	 * if this is an Iterable<Task> , it can be more efficient to use the inputTasks method to bypass certain non-NALTask conditions
	 */
	@Deprecated
	public void input(Iterable<? extends Task> tasks) {
		main().acceptAll(tasks);
	}

	@Deprecated
	public final void input(Stream<? extends Task> tasks) {
		main().acceptAll(tasks);
	}

	@Override
	public final boolean equals(Object obj) {
		return this == obj;
	}

	public NAR believe(Term c, Tense tense) {
		believe(c, tense, 1.0f, confDefault(BELIEF));
		return this;
	}

	/**
	 * activate/"turn-ON"/install a concept in the index and activates it, used for setup of custom concept implementations
	 * implementations should apply active concept capacity policy
	 */
	public final <P extends Concept & PermanentConcept> P add(P c) {

		memory.set(c);

		conceptBuilder.start(c);

		return c;
	}



//	public NAR inputBinary(File input) throws IOException {
//		return inputBinary(new GZIPInputStream(new FileInputStream(input), IO.gzipWindowBytesDefault));
//	}
//
//	public NAR outputBinary(File f) throws IOException {
//		return outputBinary(f, false);
//	}
//
//	public final NAR outputBinary(File f, boolean append) throws IOException {
//		return outputBinary(f, append, (Predicate<Task>) Function.identity());
//	}

	public final NAR outputBinary(File f, boolean append, Predicate<Task> each) throws IOException {
		return outputBinary(f, append, (Task t) -> each.test(t) ? t : null);
	}

	public NAR outputBinary(File f, boolean append, UnaryOperator<Task> each) throws IOException {
        var f1 = new FileOutputStream(f, append);
		OutputStream ff = new GZIPOutputStream(f1, IO.gzipWindowBytesDefault);
		outputBinary(ff, each);
		return this;
	}

//	public final NAR outputBinary(OutputStream o) {
//		return outputBinary(o, (Task x) -> x);
//	}

	public final NAR outputBinary(OutputStream o, Predicate<Task> filter) {
		return outputBinary(o, (Task x) -> filter.test(x) ? x : null);
	}

	/**
	 * byte codec output of matching concept tasks (blocking)
	 * <p>
	 * the each function allows transforming each task to an optional output form.
	 * if this function returns null it will not output that task (use as a filter).
	 */
	public NAR outputBinary(OutputStream o, UnaryOperator<Task> each) {

		Util.time("outputBinary", logger, () -> {

            var oo = new DataOutputStream(o);

            var total = new int[]{0};
            var wrote = new int[]{0};

            var d = new DynBytes(128);

			tasks().map(each).filter(Objects::nonNull).distinct().forEach(x -> {

				total[0]++;

				try {
                    var b = IO.taskToBytes(x, d);
					oo.write(b);
					wrote[0]++;
				} catch (IOException e) {
					if (DEBUG)
						throw new RuntimeException(e);
					else
						logger.warn("output binary", e);
				}

			});

			logger.info("{} output {}/{} tasks ({} bytes uncompressed)", o, wrote[0], total[0], oo.size());


			try {
				oo.close();
			} catch (IOException e) {
				throw new RuntimeException(e);
			}
		});

		return this;
	}

	public NAR outputText(OutputStream o, UnaryOperator<Task> each) {


        var ps = new PrintStream(o);

//		final int[] total = {0};

        var sb = new StringBuilder();
        var t = tasks().map(each).filter(Objects::nonNull);

        var sortByEvi = true;
		if (sortByEvi)
			t = t.sorted(Comparator.comparingDouble((Task z) -> -(z.BELIEF_OR_GOAL() ? ((NALTask)z).evi() : -(1/*-z.priElseZero()*/))));

		t.forEach(x -> {
//			total[0]++;

			sb.setLength(0);
			ps.println(x.appendTo(sb, true));
		});

		try {
			o.flush();
		} catch (IOException e) {
			e.printStackTrace();
		}

		return this;
	}

	public NAR output(File o, boolean binary) throws FileNotFoundException {
		return output(new BufferedOutputStream(new FileOutputStream(o), IO.outputBufferBytesDefault), binary);
	}

	public NAR output(File o, UnaryOperator<Task> f) throws FileNotFoundException {
		return outputBinary(new BufferedOutputStream(new FileOutputStream(o), IO.outputBufferBytesDefault), f);
	}

	public NAR output(OutputStream o, boolean binary) {
		return binary ?
				outputBinary(o,
						(Task x) -> x.isDeleted() ? null : x) :
				outputText(o, x -> x.isDeleted() ? null : x);
	}

	/**
	 * byte codec input stream of tasks, to be input after decode
	 * TODO use input(Stream<Task>..</Task>
	 * closes stream when finished
	 */
	public NAR inputBinary(InputStream i) throws IOException {

        var count = IO.readTasks(i, this::input);


		logger.info("input {} tasks from {}", count, i);

		i.close();

		return this;
	}

	/**
	 * The id/name of the reasoner
	 */
	public final Term self() {
		return self;
	}

	/**
	 * strongest matching belief for the target time
	 */
	public @Nullable NALTask belief(Termed x, long start, long end) {
		return answer(x, BELIEF, start, end);
	}

	public final NALTask belief(String x, long when) throws NarseseException {
		return belief($(x), when);
	}

	public final NALTask belief(Termed x, long when) {
		return belief(x, when, when);
	}

	public final NALTask belief(Term x) {
		return belief(x, ETERNAL);
	}

	public final NALTask belief(String x) throws NarseseException {
		return belief($(x), ETERNAL);
	}

	public final @Nullable NALTask answer(Term x, byte punc, long when) {
		return answer(x, punc, when, when);
	}

	public final @Nullable NALTask answer(Termed X, byte punc, long start, long end) {
        return answer(X, punc, start, end, dur());
	}

	public final @Nullable NALTask answer(Termed X, byte punc, long start, long end, float dur) {
		assert punc == BELIEF || punc == GOAL;

        var x = X.term();
        var negate = x instanceof Neg;
		if (negate)
			x = x.unneg();

		TaskTable table = table(x, punc==BELIEF);
		if (table == null || table.isEmpty()) return null;

        var y = answer(table, start, end, x, null, dur, answer.ANSWER_CAPACITY);
		return negate && y!=null ? SpecialNegTask.neg(y) : y;
	}

	@Nullable public final NALTask answer(TaskTable table, long start, long end, @Nullable Term template, @Nullable Predicate<NALTask> filter, float dur, int capacity) {
        var a = match(table, start, end, template, filter, dur, capacity);
		return a!=null ? a.task(
				//start!=TIMELESS && start!=ETERNAL
			    false
		) : null;
	}

	public final Answer match(TaskTable t, long start, long end, @Nullable Term template, @Nullable Predicate<NALTask> filter, float dur, int capacity) {
        return t.isEmpty() ? null : new Answer(template, !(t instanceof QuestionTable),
                start, end, dur,
                capacity, this).filter(filter)
                .match(t);
	}

	public void stats(boolean concepts, boolean emotions, Logger logger) {
        var s = new StringBuilder(4 * 1024);
		stats(concepts, emotions, s);
		if (!s.isEmpty())
			logger.info("{} stats\n{}", self, s);
	}

	public SortedMap<String, Object> stats(boolean concepts, boolean emotions, Appendable out) {

        var stat = stats(concepts, emotions);

		try {
			for (var e : stat.entrySet()) {
				out
					.append(e.getKey().replace(" ", "/"))
					.append(" \t ")
					.append(e.getValue().toString())
					.append('\n');
			}
			out.append('\n');
		} catch (IOException e) {
			e.printStackTrace();
		}

		return stat;
	}

	/**
	 * deletes any task with a stamp containing the component
	 */
	public final void retract(long stampComponent, Predicate<Task> each) {
		tasks().filter(x -> Longs.contains(x.stamp(), stampComponent)).filter(each.negate()).forEach(Task::delete);
	}



	/**
	 * invokes any pending tasks without advancing the clock
	 */
	public final NAR synch() {
		return this;
	}

	public final NALTask answerBelief(Term x, long when) {
		return answerBelief(x, when, when);
	}

	public final NALTask answerBelief(Term x, long start, long end) {
		return answer(x, BELIEF, start, end);
	}

	public final NALTask answerGoal(Term x, long when) {
		return answerGoal(x, when, when);
	}

	public final NALTask answerGoal(Term x, long start, long end) {
		return answer(x, GOAL, start, end);
	}

//	/**
//	 * stream of all (explicitly and inferrable) internal events
//	 */
//	public Stream<? extends WhenNative> when() {
//		return Streams.concat(
//			//TODO Streams.stream(eventTask).map(t -> ), // -> AtTask events
//			Streams.stream(eventCycle).map(WhenCycle::new),
//			Streams.stream(eventClear).map(WhenClear::new),
//			this.partStream()
//				.map((s) -> ((NARPart) s).event()).filter(Objects::nonNull),
//			exe.events()
//				.filter(t -> !(t instanceof DurLoop.WhenDur)) //HACK (these should already be included in service's events)
////            causes.stream(),
//		);
//	}

//	/**
//	 * map of internal events organized by category
//	 */
//	public final Map<Term, List<WhenNative>> whens() {
//		return when().collect(Collectors.groupingBy(WhenNative::category));
//	}

	/**
	 * stream of all registered services
	 */
	public final <X> Stream<X> parts(Class<? extends X> nAgentClass) {
		return this.partStream().filter(nAgentClass::isInstance).map(x -> (X) x);
	}

	/** the main, default, or root context. */
	@Deprecated
	Focus main;
	@Deprecated public final Focus main() {
		return main;
	}

	/**
	 * warning: the condition will be tested each cycle so it may affect performance
	 */
	public Off stopIf(BooleanSupplier stopCondition) {
		return eventCycle.onWeak(n -> {
			if (stopCondition.getAsBoolean())
				stop();
		});
	}

	@Deprecated
	public final Term eval(Term x) {
		if (x instanceof Compound c) {
            var y = evaluator.first(c);
			if (y != null)
				return y;
		}
		return x;
	}

	/**
	 * conceptualize a target if dynamic truth is possible; otherwise return concept if exists
	 * try to use beliefTableDynamic(Termed concept) to avoid unnecessary Concept construction
	 */
	public final Concept conceptualizeDynamic(Termed concept) {

		Term ct;
		Termed x;
		if (concept instanceof Concept) {
			ct = (x = concept).term();
		} else {
			if ((ct = conceptTerm(concept, true)) == null)
				return null;
			x = ct;
		}

        var y = concept(x);
		return y != null ? y :
				conceptBuilder.apply(ct, false, true);
	}

	public @Nullable TaskTable table(Termed concept, byte punc, boolean conceptualize) {
		return switch (punc) {
			case BELIEF -> table(concept, true, conceptualize);
			case GOAL ->   table(concept, false, conceptualize);
			default -> {
                var exist = concept(concept, conceptualize);
				yield exist instanceof TaskConcept tc ? tc.table(punc) : null;
			}
		};
	}

	public final @Nullable BeliefTable table(Termed c, boolean beliefOrGoal) {
		return table(c, beliefOrGoal, false);
	}

	public final @Nullable BeliefTable table(Termed c, boolean beliefOrGoal, boolean conceptualize) {
		@Nullable Term ct = conceptTerm(c, true);
		if (ct == null) return null;
		var y = _conceptualize(ct, conceptualize);
        return y != null ? tableActual(beliefOrGoal, y) : DynTables.tableDyn(ct, beliefOrGoal);
    }

	/**  concept exists, use its table */
	@Nullable private static BeliefTable tableActual(boolean beliefOrGoal, Concept y) {
		return y instanceof TaskConcept c ?
			(BeliefTable) c.table(beliefOrGoal ? BELIEF : GOAL)
			: null;
	}


	public final Off on(Every cycle, Consumer<NAR> c) {
		return cycle.on(this, 1, c);
	}

	public final Off on(Every cycle, float amount, Consumer<NAR> c) {
		return cycle.on(this, amount, c);
	}

	public static void proofPrint(TruthProjection r /*, Appendable out*/) {
		for (var x : r) {
			proofPrint(x);
			System.out.println();
		}
	}

	@Nullable public final TaskConcept conceptualizeTask(Termed x) {

        var c = conceptualize(x);

		if (c instanceof TaskConcept C) {
			if (test.DEBUG_EXTRA && !x.term().equalsRoot(C.term()))
				throw new TermTransformException("conceptualization mismatch", x.term(), c.term());

			return C;
		} else {
			/*
			  TODO
			  ex:
			     externalTerm = {CachedCompound@8003} "(((#1,#2),\,((#1,5)-->$3))-->((#2,-6)-->$3))"
			     internalTerm = {CachedCompound@6850} "((#1,#2)-->(((#2,-6)-->$3),((#1,5)-->$3)))"
			*/
			if (DEBUG && c!=null)
				throw new TermTransformException("conceptualized to non-TaskConcept: " + c.getClass(), x.term(), c.term());

			return null;
		}

	}

	/**
	 * desire goal
	 */
	@Deprecated
	public NALTask want(Term x, float freq, float conf, Tense tense) {
        var now = time(tense);
		return want(priDefault(GOAL), x, now, now, freq, conf);
	}

	@Deprecated
	public NALTask believe(Term term, Tense tense, float freq, float conf) {
		return believe(term, time(tense), freq, conf);
	}

	public NALTask believe(Term term, long when, float freq, float conf) {
		return believe(priDefault(BELIEF), term, when, freq, conf);
	}

	public NALTask believe(Term term, long when, float freq) {
		return believe(term, when, freq, confDefault(BELIEF));
	}

	public NALTask believe(Term term, float freq, float conf) {
		return believe(term, Tense.Eternal, freq, conf);
	}

	public NALTask want(Term term, float freq, float conf) {
		return want(term, freq, conf, Tense.Eternal);
	}

	@Deprecated
	public NALTask believe(String term, Tense tense, float freq, float conf) {
		try {
			return believe(priDefault(BELIEF), $(term), time(tense), freq, conf);
		} catch (NarseseException e) {
			throw new RuntimeException(e);
		}
	}

	public NALTask believe(String termString, float freq, float conf) {
		return believe(termString, freq, conf, ETERNAL, ETERNAL);
	}

	public NALTask believe(String termString, float freq, float conf, long start, long end) {
		return believe($$(termString), freq, conf, start, end);
	}

	public NALTask want(String termString, float freq, float conf, long start, long end) {
		return want($$(termString), freq, conf, start, end);
	}

	public NALTask want(String termString) {
		return want($$(termString));
	}

	public void believe(String... tt) throws NarseseException {
		for (var b : tt)
			believe(b, true);
	}

	/**
	 * ask question
	 */
	public NALTask question(String termString) throws NarseseException {
		return question($(termString));
	}

	/**
	 * ask question
	 */
	public NALTask question(Term c) {
		return ask(c, QUESTION);
	}

	public NALTask quest(Term c) {
		return ask(c, QUEST);
	}

	public NALTask input(float pri, Term term, byte punc, long start, long end, @Nullable Truth truth) throws TaskException {
        var z = NALTask.task(term, punc, truth, start, end, evidence());
		z.pri(pri);
		input(z);
		return z;
	}

	public NALTask believe(Term term, long start, long end) throws TaskException {
		return input(priDefault(BELIEF), term, BELIEF, start, end, $.t(1.0f, confDefault(BELIEF)));
	}

	public NALTask believe(Term term, float freq, float conf, long start, long end) throws TaskException {
		return input(priDefault(BELIEF), term, BELIEF, start, end, $.t(freq, conf));
	}

	public NALTask want(Term term, float freq, float conf, long start, long end) throws TaskException {
		return want(priDefault(GOAL), term, start, end, freq, conf);
	}

	public NALTask believe(float pri, Term term, long occurrenceTime, float freq, float conf) throws TaskException {
		return input(pri, term, BELIEF, occurrenceTime, occurrenceTime, $.t(freq, conf));
	}

	public NALTask want(float pri, Term goal, long start, long end, float freq, float conf) throws TaskException {
		return input(pri, goal, GOAL, start, end, $.t(freq, conf));
	}

	public NALTask ask(Term term, byte punc, long... startEnd) {
		assert startEnd.length == 2;
		return input(priDefault(punc), term, punc, startEnd[0], startEnd[1], null);
	}

	/**
	 * ¿qué?  que-stion or que-st
	 */
	public NALTask ask(Term term, byte punc) {
		return ask(term, punc, ETERNAL, ETERNAL);
	}

	public NALTask believe(String termString, boolean isTrue) throws NarseseException {
		return believe($(termString), isTrue);
	}

	public NALTask believe(Term term) {
		return believe(term, true);
	}

	public NALTask believe(Term term, boolean trueOrFalse) {
		return believe(term, trueOrFalse, confDefault(BELIEF));
	}

	public NALTask want(Term term) {
		return want(term, 1.0f, confDefault(GOAL));
	}

	public NALTask believe(Term term, boolean trueOrFalse, float conf) {
		return believe(term, trueOrFalse ? 1.0f : 0.0f, conf);
	}

	public NALTask want(Term term, boolean trueOrFalse, float conf) {
		return want(term, trueOrFalse ? 1.0f : 0.0f, conf);
	}

	public NALTask believe(Term term, long when) throws TaskException {
		return believe(term, when, when);
	}

	public final float throttle() {
		return cpuThrottle.asFloat();
	}

	public final void throttle(float t) {
		cpuThrottle.set(t);
		Loop.logger.info("{} throttle={}", self(), t);
	}


	/** advised global CPU usage level, for components to follow */
	public final FloatRange cpuThrottle = FloatRange.unit(1);

	/**
	 * self managed set of processes which run a NAR
	 * as a loop at a certain frequency.
	 * starts paused; thread is not automatically created
	 */
	public final class NARLoop extends InstrumentedLoop {

		private static final boolean async = true; //TODO false if single-threaded

		@Override
		protected void starting() {
			super.starting();
			parts(Pausing.class).forEach(g->g.pause(false));
		}

		@Override
		protected void stopping() {
			parts(Pausing.class).forEach(g->g.pause(true));
			super.stopping();
		}


		private final Runnable ready = this::ready;

		@Override
		public final boolean next() {
			exe.run(time.next());

			if (async)
				eventCycle.emitAsync(NAR.this, exe, ready);
			else
				eventCycle.accept(NAR.this);

			return true;
		}

		@Override
		protected boolean async() {
			return async;
		}

		public NAR nar() {
			return NAR.this;
		}

		public void startPeriodMS(int periodMS) {
			startThread(periodMS);
		}

	}

	public static final String VERSION = "NARchy v?.?";

}