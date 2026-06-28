package jcog.pri.bag.impl;

import jcog.Is;
import jcog.TODO;
import jcog.Util;
import jcog.data.bit.AtomicIntBitSet;
import jcog.data.bit.LongArrayBitSet;
import jcog.data.bit.MetalBitSet;
import jcog.data.list.Lst;
import jcog.data.map.ObjShortHashMap;
import jcog.pri.Prioritizable;
import jcog.pri.Prioritized;
import jcog.pri.bag.Bag;
import jcog.pri.distribution.DistributionApproximator;
import jcog.pri.distribution.ExactHistogram;
import jcog.pri.distribution.SketchHistogram;
import jcog.pri.op.PriMerge;
import jcog.signal.NumberX;
import jcog.sort.ShortIntSmoothSort;
import jcog.sort.SortedIntArray;
import jcog.util.ArrayUtil;
import jcog.util.PriReturn;
import jcog.util.SingletonIterator;
import org.eclipse.collections.api.block.function.primitive.ShortFunction;
import org.eclipse.collections.api.block.function.primitive.ShortToFloatFunction;
import org.eclipse.collections.api.block.function.primitive.ShortToIntFunction;
import org.jetbrains.annotations.Nullable;
import org.roaringbitmap.RoaringBitmap;

import java.lang.invoke.MethodHandles;
import java.lang.invoke.VarHandle;
import java.util.Arrays;
import java.util.Collections;
import java.util.ConcurrentModificationException;
import java.util.Iterator;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.locks.StampedLock;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.random.RandomGenerator;

import static jcog.Util.clampSafe;
import static jcog.Util.emptyIterator;


/**
 * A bag implemented as a combination of a
 * Map and a SortedArrayList
 * <p>
 * ArrayBag, does maintain an eventually sorted array
 * (an exhausive sort happens at each .commit but item
 * priority can change in between) and this is directly
 * sampled from according to priority (using a compued
 * priority histogram for fairness when priority is not
 * distributed linearly, which in most cases it wont be).
 * <p>
 * this makes insertions and evictions simple because
 * it's just a matter of comparing against the lowest
 * ranked item's priority.
 * <p>
 * TODO extract a version of this which will work for any Prioritized, not only BLink
 */
public abstract class ArrayBag<X, Y extends Prioritizable> extends Bag<X, Y> {

    public static final float SHARP_DEFAULT =
        1;
        //2;
        //4;
        //0.5f;

    static final int DIRECT_SAMPLE_MAX = 8;
    /**
     * may not be safe because it will discard merges when item is present
     */
    //static final boolean fastReject = false;
    private static final int HISTOGRAM_THRESH = 4;
    /**
     * >= 1.  higher values increase histogram sampling precision
     */
    private static final int HISTOGRAM_DETAIL =
            1;
    @Is("Inelastic_collision")
    private static final boolean pressurizeAccept = true;
    //new ArrayHistogram();
    @Is("Elastic_collision")
    private static final boolean pressurizeReject = true;

    public DistributionApproximator hist = DistributionApproximator.Empty;

    final ArrayBagModel<X, Y> map;
    private final SortedIntArray list = new SortedIntArray();
    private final StampedLock lock = new StampedLock();
    public float sharp = SHARP_DEFAULT;
    private transient volatile float priMin;

    /**
     * capacity is initially zero
     */
    public ArrayBag(PriMerge merge, ArrayBagModel<X, Y> m) {
        this(m);
        merge(merge);
    }

    protected ArrayBag(ArrayBagModel<X, Y> m) {
        this.map = m;
    }

    protected ArrayBag(PriMerge merge) {
        this(merge, new ListArrayBagModel<>());
    }

    /**
     * whether to attempt re-sorting the list after each merge, in-between commits
     */
    protected boolean sortContinuously() {
        //TODO try policy of: randomly in proportion to bag fill %
        return true;
        //return false;
    }

    /**
     * override and return 0 to effectively disable histogram sampling (for efficiency if sampling isnt needed)
     */
    protected int histogramBins(int s) {
        //if (s <= 1) return 0;
        if (s <= 2) return 2;

        //int thresh = HISTOGRAM_THRESH; return HISTOGRAM_DETAIL * (s <= thresh ? s : thresh + (int) (Math.log(1 + s - thresh)));

        /*
        The ideal number of bins depends on your specific use case, but there are some general guidelines:
            a) Sturges' Rule: bins = 1 + log2(s)
            b) Rice Rule: bins = 2 * s^(1/3)
            c) Freedman-Diaconis' Rule: bin width = 2 * IQR * s^(-1/3), where IQR is the interquartile range.
        https://www.toolfk.com/online-plotter-frame#W3sidHlwZSI6MCwiZXEiOiIxK2xvZyh4KS9sb2coMikiLCJjb2xvciI6IiNENDAwMDAifSx7InR5cGUiOjAsImVxIjoiMip4XigxLzMpIiwiY29sb3IiOiIjNDAwNENDIn0seyJ0eXBlIjoxMDAwLCJ3aW5kb3ciOlsiLTE4LjM2MjQwNTQ0Njg1OTQ5IiwiMTIxLjMzNTk4MDc0NTQ2MjIiLCItMS4xNDc0MDMwOTExOTIyNDIyIiwiMTAuNDk0MTI5MDkxNTAxMjI1Il0sInNpemUiOls2NDksMzk5XX1d
        */
        //return (int) Math.ceil(1 + log2(s));
        return (int) Math.ceil(3 * Math.pow(s, 1 / 3f));
    }

    @Override
    public final void clear() {
        pop(Integer.MAX_VALUE, false, null);
    }

    @Deprecated
    private short[] items() {
        return list.items;
    }

    @Override
    public final int size() {
        return list.size();
    }

//    /** different from sample(..); this will return uniform random results */
//    public final @Nullable Y get(Random rng) {
//        Object[] items = this.items.items;
//        int s = Util.min(items.length, size());
//        return s > 0 ? (Y)items[rng.nextInt(s)] : null;
//    }

    @Nullable
    @Override
    public final Y get(Object key) {
        return map.get(key);
    }


//    @Override
//    public Stream<Y> stream() {
//        ////return IntStream.range(0, s).map(i -> sort[i]).mapToObj(i -> model.get((short) i)).filter(Objects::nonNull);
//        return Streams.stream(this);
//    }

    public final @Nullable Y get(int index) {
        return map.get(list.get(index));
    }

    @Override
    protected final void _setCapacity(int before, int after) {
        var l = lock.writeLock(); //TODO read -> write
        try {
            if (after < size())
                _commit(null);
            list.capacity(after);
            map.capacity(after);
        } finally {
            lock.unlockWrite(l);
        }
    }

    protected float sortedness() {
        return 1f;
    }

    private void sort() {
        var s = size();
        if (s <= 1)
            return;

        var c = sortedness();
        int from, to;

        if (c >= 1 - Float.MIN_NORMAL) {
            //int from /* inclusive */, int to /* inclusive */
            from = 0;
            to = s;
        } else {
            var f = ThreadLocalRandom.current().nextFloat();
            var toSort = (int) Math.ceil(c * s);
            var center = (int) (Util.sqr(f) * (s - toSort) + toSort / 2f); //sqr adds curve to focus on the highest priority subsection
            from = Math.max(0, Math.max(center - toSort / 2, 0));
            to = clampSafe(Math.min(center + toSort / 2, s), from, s);
            if (to - from <= 0)
                return;
        }

        _sort(from, to);
    }

    private void _sort(int from, int to) {
        //boolean wasSorted = isSorted();
        new ShortIntSmoothSort(items(), map.priInt).sort(from, to);
//        boolean isSorted = isSorted();
//        if (!isSorted)
//            throw new WTF(); //TEMPORARY
//        QuickSort.quickSort(from, to, (a,b)->
//            Integer.compare(model.priInt((short)a),model.priInt((short)b)),
//            ArrayUtil.swapper(items())
//        );
    }

    /**
     * update histogram, remove values until under capacity
     */
    private void _commit(@Nullable Consumer<? super Y> update) {

        var sorted = true;

        double m = 0;
        var p0 = Float.POSITIVE_INFINITY;
        short[] xy;
        var n = size();
        if (n > 0) {
            RoaringBitmap removals = null;

            xy = list.array();
            //s = Math.min(xy.length, s);

            for (var i = 0; i < n; i++) {

                var x = xy[i];
                var y = map.get(x);

                var p = update != null ? priUpdate(x, y, update) : pri(y);

                if (p == p) {

                    m += p;

                    if (sorted) {
                        if (p - p0 >= 0/*EPSILON / 2*/)
                            sorted = false;
                        else
                            p0 = p;
                    }

                } else {
                    (removals == null ? removals = new RoaringBitmap() : removals).add(i);
                }
            }

            if (removals != null)
                n = removeRemovals(n, removals);

        } else {
            xy = null;
        }

        commitHistogram(commitSort(n, sorted), m, xy);
    }

    private int commitSort(int n, boolean sorted) {
        if (n > 0) {
            if (!sorted && n > 1)
                sort();

            var c = capacity();
            if (n > c)
                return _free(n - c);
        }
        return n;
    }

    private void commitHistogram(int n, double m, short[] xy) {
        if (n > DIRECT_SAMPLE_MAX && !(hist instanceof SketchHistogram)) {
            hist = new SketchHistogram();
        } else if (n > 0 && hist == DistributionApproximator.Empty) {
            hist = new ExactHistogram();
        }

        float pMin;
        if (n > 0) {
            pMin = pri(xy[n - 1]);
            if (n > 1) {
                var pMax = pri(xy[0]);
                commitHistogram(xy, n,
                    pMax, 0          //Normalized to Max Only
                    //pMax - pMin, pMin //High-Contrast
                );
            }
        } else {
            //empty
            m = 0;
            pMin = 0;
        }

        priMin = pMin;
        massSet((float) m);
    }

    private float priUpdate(short x, Y y, Consumer<? super Y> update) {
        update.accept(y);
        var priUpdated = pri(y);
        pri(x, priUpdated);
        return priUpdated;
    }

    private int removeRemovals(int n, RoaringBitmap removals) {
        var rr = removals.getReverseIntIterator();
        while (rr.hasNext()) {
            _remove(list.remove(rr.next()));
            n--;
        }
        return n;
    }

    @Deprecated
    private void commitHistogram(short[] x, int n, float pRange, float pMin) {
        map.histogram(x, n, histogramBins(n), pMin, pRange, hist);
    }

    private int _free(int toRemove) {
        var s = list.size();
        if (toRemove > 0) {
            for (var i = 0; i < toRemove; i++)
                evicted(_remove(list.get(--s)));
            list.removeLast(toRemove);
        }
        return s;
    }

    /**
     * immediate sample
     */
    @Override
    @Nullable
    public Y sample(RandomGenerator rng) {
        var items = this.items();
        var s = Math.min(items.length, size());
        return s == 0 ? null : map.get(items[sample(randomCurve(rng))]);
    }

    private int sample(float r) {
        return hist.sampleInt(r);
    }

    private float randomCurve(RandomGenerator rng) {
        var v = rng.nextFloat();
        var s = sharp;
        return s == 1 ? v : (float) Math.pow(v, s);
    }

    private double massExact(int s, short[] items) {
        double mass = 0;
        for (var i = s - 1; i >= 0; i--)
            mass += map.pri(items[i]);
        return mass;
    }

    /**
     * chooses a starting index randomly then iterates descending the list
     * of items. if the sampling is not finished it restarts
     * at the top of the list. so for large amounts of samples
     * it will be helpful to call this in batches << the size of the bag.
     */
    @Override
    public void sample(RandomGenerator rng, Function<? super Y, SampleReaction> each) {
        Y y;
        while ((y = sample(rng)) != null) {

            var next = each.apply(y);

            if (next.remove) {
                remove(key(y));
            } else {
                if (rng == null)
                    throw new TODO("without a fix, this will continue to spin on 0th item"); //HACK
            }

            if (next.stop)
                return;

        }
    }

    /**
     * warning: not thread-safe
     */
    @Override
    public final Iterator<Y> sampleUnique(RandomGenerator rng) {
        var s = size();
        if (s > 0) {
            var items = items();
            if ((s = Math.min(s, items.length)) > 0)
                return s == 1 ?
                        new SingletonIterator<>(map.get(items[0])) :
                        map.sampleUnique(items, s, sample(rng.nextFloat()));
        }
        return emptyIterator;
    }

    @Override
    public final @Nullable Y remove(X x) {
        var l = lock.writeLock();
        try {
            var i = map.id(x);
            return i < 0 ? null : _remove(x, i);
        } finally {
            lock.unlockWrite(l);
        }
    }

    private Y _remove(X x, short i) {
        if (list.remove(i, map)) {
            var removed = map.remove(x, this); //HACK
            if (removed != null)
                return removed;
        }
        throw new ConcurrentModificationException("inconsistency while attempting removal: " + x + "," + i);
    }

    @Override
    @Nullable
    public Y put(Y x, @Nullable NumberX overflow) {
        float x1 = x.pri();
        var xp =
                Math.max(x1, Prioritized.EPSILON);
            //x.pri();
        if (xp != xp) return null; //already deleted

        var l = lock.writeLock();

        var k = key(x);

        var existingID = map.id(k);
        return existingID < 0 ?
                insert(k, x, xp, l) :
                merge(existingID, x, xp, l, overflow);
    }

    private Y merge(short existingID, Y x, float priNext, long l, NumberX overflow) {
        var existing = map.get(existingID);

        float delta;
        try {
            if (existing == x)
                //return existing;
                throw new UnsupportedOperationException(); //exact same instance; won't work because of how this modifies the PLink etc

            var priBefore = pri(existingID);
            priNext = merge(existing, x, priNext);
            delta = priNext - priBefore;
            if (delta != 0)
                priUpdate(existing, existingID, priBefore, priNext);
        } finally {
            this.lock.unlock(l);
        }

        if (delta != 0)
            mergeUpdate(priNext, delta, overflow);

        return existing;
    }

    @Nullable
    private Y insert(X key, Y incoming, float pri, long lock) {
        return insertFinish(incoming, pri, tryInsert(key, incoming, pri, lock));
    }

    private boolean tryInsert(X key, Y incoming, float pri, long lock) {
        try {
            int size = size(), capacity = capacity();
            boolean inserted;
            if (inserted = acceptInsert(pri, size, capacity))
                insert(key, incoming, pri, size, capacity);
            return inserted;
        } finally {
            this.lock.unlock(lock);
        }
    }

    private void insert(X key, Y incoming, float pri, int size, int capacity) {
        _free(1 + size - capacity);
        var item = map.put(key, incoming, pri);
        var index = list.insert(item, -pri, map);

        assert (index >= 0 && index < capacity);

        _priMin();
    }

    private @Nullable Y insertFinish(Y incoming, float pri, boolean inserted) {
        if (inserted) {
            if (pressurizeAccept)
                pressurize(pri);
            massAdd(pri);
            onAdd(incoming);
            return incoming;
        } else {
            reject(incoming, pri);
            return null;
        }
    }

    private void reject(Y incoming, float pri) {
        if (pressurizeReject)
            pressurize(pri);
        onReject(incoming);
    }

    private boolean acceptInsert(float pri, int size, int capacity) {
        return size < capacity || (size > 0 && _priMin() <= /* < */ pri);
    }

    /**
     * update priMin
     */
    private float _priMin() {
        return priMin = pri(list.last());
    }

    private float pri(short i) {
        return map.pri(i);
    }

    private void pri(short i, float p) {
        map.pri(i, p == p ? p : -1);
    }

    private void mergeUpdate(float incomingPri, float delta, @Nullable NumberX overflow) {
        if (overflow != null) {
            var over = Math.max((float) 0, incomingPri - delta);
            if (over > 0)
                overflow.add(over);
        }

        if (pressurizeAccept)
            pressurize(delta);

        massAdd(delta);
    }

    private void priUpdate(Y y, short id, float priBefore, float priNext) {
        pri(id, priNext);

        priMin = Math.min(priMin, priNext);

        if (sortContinuously())
            list.update(id, priBefore, priNext, map);
    }

    /**
     * returns resulting priority
     */
    protected float merge(Y existing, Y incoming, float incomingPri) {
        return merge.apply(existing, incomingPri, PriReturn.Result);
    }

    /**
     * remove from list should have occurred before the map removal
     */
    private Y _remove(short i) {
        return map.remove(key(map.get(i)), this);
    }


    @Override
    public void commit(@Nullable Consumer<? super Y> update) {

        var l = lock.writeLock(); //sync
        try {
            _commit(update);
        } finally {
            lock.unlockWrite(l);
        }

    }

    /**
     * called when removed non-explicitly
     */
    private void evicted(Y y) {

//        float p = priElse(y, 0);
//        if (p > Float.MIN_NORMAL) massAdd(-p);

        onRemove(y);
    }

    /**
     * warning: doesnt lock
     */
    @Override
    public void forEach(Consumer<? super Y> action) {
        forEach(Integer.MAX_VALUE, action);
    }

    public void popBuffer(int n, float forget, Lst<Y> popped, Consumer<? super Y> each) {
        popped.ensureCapacity(n);

        popBatch(n, forget, popped::addFast);

        popped.forEach(each);
    }

    /**
     * removes the top n items
     *
     * @param n # to remove, if -1 then all are removed
     */
    public void pop(int n, boolean buffered, Consumer<? super Y> each) {
        float forget = 1;
        if (buffered) popBuffer(n, forget, new Lst<>(), each);
        else popBatch(n, forget, each);
    }


    /**
     * TODO option for buffering to a list to escape critical section quicker than calling the popped lambda
     */
    public void popBatch(int n, float forget, @Nullable Consumer<? super Y> popped) {
        if (n <= 0)
            return;

        var l = lock.writeLock();
        try {
            //verify(); //TEMPORARY

            var s = size();
            var toRemove = Math.min(n, s);
            if (toRemove > 0) {
                if (toRemove < s) {
                    //SOME
                    list.removeRange(0, toRemove,
                            popped != null ?
                                    i -> {
                                        popped.accept(_remove(i));

//                                    var removed = map.get(i);
//                                    popped.accept(removed);
//                                    map.remove(i, this);
                                    }
                                    :
                                    this::_remove
                    );
                    _commit(forget(forget));

                } else {
                    //ALL
                    if (popped != null)
                        list.forEach(i -> popped.accept(map.get(i)));
                    list.clear();
                    map.clear();
                    massSet(0);
                    pressureZero();
                    priMin = 0;
                }
            }
        } finally {
            lock.unlockWrite(l);
        }
    }

    /**
     * for testing purposes
     */
    private void verify() {
        var ms = map.size();
        var ss = list.size();
        if (ms != ss)
            throw new NullPointerException("model/sort fault: model=" + ms + ", sort=" + ss);
        list.forEach(s -> {
            if (map.get(s) == null)
                throw new NullPointerException("missing entry for id=" + s);
        });
    }


    @Override
    public float pri(Y value) {
        return value.pri();
    }

    @Override
    public float priMax() {
        var s = list.first();
        return s >= 0 ? map.pri(s) : 0;
//        Y x = map.get(list.first());
//        return x != null ? priElse(x, 0) : 0;
    }

    @Override
    public float priMin() {
        return priMin;
//        Y x = items.last();
//        return x != null ? priElse(x, 0) : 0;
    }

    public final Iterator<Y> iterator() {
        var list = items();
        var s = Math.min(size(), list.length);
        return s == 0 ? Collections.emptyIterator() :
                map.iterator(list, s);
    }

    /**
     * for diagnostic purposes
     */
    final boolean isSorted() {
        return list.isSorted(map);
    }

    @Override
    public final void forEach(int max, Consumer<? super Y> action) {
//        long l = lock.readLock();
//        try {
        var s = size();
        if (s > 0)
            map.forEach(items(), action, Math.min(s, max));
//        } finally {
//            lock.unlockRead(l);
//        }
    }







//    /**
//     * priority of the middle index item, if exists; else returns average of priMin and priMax
//     */
//    private float priMedian() {
//
//        Object[] ii = table.items.items;
//        int s = Util.min(ii.length, size());
//        if (s > 2)
//            return pri((Y) ii[s / 2]);
//        else if (s > 1)
//            return (priMin() + priMax()) / 2;
//        else
//            return priMin();
//    }

    public abstract static class ArrayBagModel<X, Y> implements ShortToFloatFunction {

        final ShortToIntFunction priInt = this::priInt;


        @Override
        public final float valueOf(short y) {
            return -priElseNeg1(y);
        }

        protected abstract void histogramLoad(short[] items, int n, float pMin, float pRange, DistributionApproximator h);

        public abstract Y remove(X x, Bag b);

        protected abstract Y remove(short xy, Bag b);


        @Nullable
        Y get(Object key) {
            var i = id(key);
            return i >= 0 ? get(i) : null;
        }

        protected abstract Y get(short index);

        protected abstract short id(Object key);


        /**
         * put(..) semantics
         */
        protected abstract short put(X key, Y incoming, float pri);

        protected abstract int size();

        protected abstract void capacity(int after);

        /**
         * priority set
         */
        protected abstract void pri(short id, float p);

        /**
         * priority get
         */
        protected abstract float pri(short id);

        /**
         * priority get, as float->integer bits
         */
        final int priInt(short i) {
            return Float.floatToIntBits(priElseNeg1(i));
        }

        final void histogram(short[] items, int n, int bins, float pMin, float pRange, DistributionApproximator h) {
            h.start(bins, n);
            if (bins < 2 || pRange < Float.MIN_NORMAL)
                h.commit2(0, n - 1);
            else {
                histogramLoad(items, n, pMin, pRange, h);
                h.commit(0, n - 1, bins);
            }
        }

        final float priElse(short y, float f) {
            var p = pri(y);
            return (p == p) ? p : f;
        }

        final float priElseNeg1(short y) {
            return priElse(y, -1);
        }

        final float priElseZero(short y) {
            return priElse(y, 0);
        }

        void forEach(short[] list, Consumer<? super Y> action, int max) {
            var n = Math.min(max, list.length);
            for (var j = 0; j < n; j++) {
                var v = get(list[j]);
                if (v != null)
                    action.accept(v);
            }
        }

        final Iterator<Y> iterator(short[] list, int s) {
            return new ArrayBagIterator(list, s);
        }

        abstract Iterator<Y> sampleUnique(short[] items, int s, int sampleNext);

        public double priMean(short[] items, int c) {
            c = Math.min(c, items.length);
            if (c == 0) return 0;

            double s = 0;
            for (var i = 0; i < c; i++)
                s += priElseZero(items[i]);
            return s / c;
        }

        abstract public void clear();


        private final class ArrayBagIterator implements Iterator<Y> {
            private final int s;
            private final short[] list;
            private int i;
            private Y k;

            ArrayBagIterator(short[] list, int s) {
                this.list = list;
                this.s = Math.min(list.length, s);
            }

            @Override
            public boolean hasNext() {
                if (k != null)
                    return true;

                while (i < s && (k = get(list[i++])) == null) {
                }
                return k != null;
            }

            public Y next() {
                var kk = this.k;
                this.k = null;
                return kk;
            }
        }
    }

    /**
     * fast, safe for single-thread use
     */
    public static class PlainListArrayBagModel<X, Y> extends ListArrayBagModel<X, Y> {

        protected MetalBitSet bits(int cap) {
            return new LongArrayBitSet(cap);
        }

        @Override
        public Y get(short index) {
            return (Y) list[index];
        }

        @Override
        protected Y remove(short xy) {
            var prev = (Y) list[xy];
            list[xy] = null;
            return prev;
        }

        @Override
        protected void set(int xy, Y y) {
            list[xy] = y;
        }
    }

    public static class ListArrayBagModel<X, Y> extends ArrayBagModel<X, Y> implements ShortFunction<Y> {
        private static final VarHandle LIST =
                MethodHandles.arrayElementVarHandle(Object[].class)
                        .withInvokeExactBehavior();

        private final ObjShortHashMap<X> map;
        protected /*volatile*/ Object[] list = ArrayUtil.EMPTY_OBJECT_ARRAY;
        protected /*volatile*/ float[] pri = ArrayUtil.EMPTY_FLOAT_ARRAY;
        private /*volatile*/ MetalBitSet used = AtomicIntBitSet.EMPTY;
        private /*volatile*/ int cap;

        public ListArrayBagModel() {
            this.map = new ObjShortHashMap<>(0);
        }

        protected MetalBitSet bits(int cap) {
            return new AtomicIntBitSet(cap);
        }

        @Override
        Iterator<Y> sampleUnique(short[] items, int s, int sampleNext) {
            return new UniqueSampleIterator<>(s, sampleNext, items, list);
        }

        @Override
        public void clear() {
            var c = cap;
            used.clear();
            Arrays.fill(list, 0, c, null);
            map.clear();
        }

        @Override
        public Y get(short xy) {
            return (Y) LIST.getAcquire(list, (int) xy);
        }

        protected Y remove(short xy) {
            return (Y) LIST.getAndSetRelease(list, (int) xy, (Object) null);
        }

        @Override
        public void capacity(int cap) {
            //TODO resize, trim the bag if necessary

            int capPrev;
            if ((capPrev = pri.length) < cap)
                grow(cap, capPrev);

            this.cap = cap;
        }

        private void grow(int cap, int capPrev) {
            var nextPri = Arrays.copyOf(pri, cap);
            Arrays.fill(nextPri, capPrev, cap, Float.NaN);
            var nextList = Arrays.copyOf(list, cap);
            //TODO better atomic. maybe fill the current bitvector while setting
            var u = bits(cap);
            for (var i = 0; i < capPrev; i++) if (nextList[i] != null) u.set(i);
            used = u;
            VarHandle.fullFence(); // Consider adding this fence
            list = nextList;
            pri = nextPri;
        }

        @Override
        protected void histogramLoad(short[] items, int n, float pMin, float pRange, DistributionApproximator h) {
            var pri = this.pri;
            for (var i = 0; i < n; i++) {
                var p = pri[items[i]];
                if (p == p) {
                    h.accept(
                            (p - pMin) / pRange //NORMALIZED TO RANGE
                    );
                }
            }
        }

        public final Y remove(X x, Bag b) {
            var xy = map.removeKeyIfAbsent(x, (short) -1);
            if (xy < 0)
                throw new NullPointerException();

            //VarHandle.fullFence(); //experimental. intended to enforce changes in non-volatile 'map' before continuing

            return remove(xy, b);
        }

        @Override
        protected Y remove(short xy, Bag b) {
            var y = remove(xy);

            var pri = this.pri;
            var p = pri[xy];
            pri[xy] = Float.NaN;

            VarHandle.fullFence(); // Consider adding this fence

            used.clear(xy);

            if (pressurizeAccept)
                b.depressurize(p);

            return y;
        }

        /**
         * acquires a new slot
         */
        @Override
        public short shortValueOf(Y y) {
            var xy = used.setNext(cap);
            if (xy < 0)
                throw new NullPointerException(/*x.toString()*/);

            set(xy, y);

            return (short) xy;
        }

        protected void set(int xy, Y y) {
            LIST.setRelease(list, xy, y);
        }

        @Override
        public short put(X x, Y y, float p) {
            var s = map.getIfAbsentPutWith(x, this, y);
            VarHandle.storeStoreFence(); //??
            pri[s] = p;
            return s;
        }

        @Override
        public short id(Object key) {
            return map.getIfAbsent(key, (short) -1);
        }

        @Override
        public int size() {
            return map.size(); //assert(m == used.size());
        }

        @Override
        public void pri(short id, float p) {
            pri[id] = p;
        }

        public float pri(short id) {
            return pri[id];
        }

    }

    private static final class UniqueSampleIterator<Y> implements Iterator<Y> {
        private final short[] items;
        private final Object[] list;
        private final int s;
        private int u, d;
        private Y next;
        private boolean dir;

        UniqueSampleIterator(int s, int sampleNext, short[] items, Object[] list) {
            this.s = s;
            this.u = sampleNext;
            this.d = sampleNext + 1;
            this.items = items;
            this.list = list;
        }

        Y get(int i) {
            return (Y) list[items[i]];
        }

        private boolean _hasNext() {
            int n;
            if ((this.dir = (!this.dir))) {
                if ((n = u--) < 0) return false; //up
            } else {
                if ((n = d++) >= s) return false; //down
            }
            return (next = get(n)) != null;
        }

        @Override
        public boolean hasNext() {
            return next != null || _hasNext() || _hasNext();
        }

        @Override
        public Y next() {
            var n = this.next;
            this.next = null;
            return n;
        }
    }
}
