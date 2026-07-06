/**
 * Collection utilities for SeNARS
 */
export {Statistics} from './Statistics.js';

/**
 * Sort array by property
 */
export const sortByProperty = (items, prop, desc = false) => {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }
    return [...items].sort((a, b) => {
        const aVal = a[prop] ?? 0;
        const bVal = b[prop] ?? 0;
        return desc ? bVal - aVal : aVal - bVal;
    });
};

export const filterBy = (items, predicate) => items.filter(predicate);
export const findBy = (items, predicate) => items.find(predicate);

export const groupBy = (items, keyFn) => {
    if (!Array.isArray(items) || items.length === 0) {
        return {};
    }
    return items.reduce((groups, item) => {
        const key = keyFn(item) ?? 'unknown';
        (groups[key] ??= []).push(item);
        return groups;
    }, {});
};

export const applyToAll = (items, fn) => items.forEach(fn);
export const createMap = (items, keyFn, valueFn = x => x) =>
    Array.isArray(items) ? new Map(items.map(item => [keyFn(item), valueFn(item)])) : new Map();
export const createSet = (items, keyFn = x => x) =>
    Array.isArray(items) ? new Set(items.map(keyFn)) : new Set();

export const chunk = (array, size) => {
    if (!Array.isArray(array) || size <= 0) {
        return [];
    }
    return Array.from({length: Math.ceil(array.length / size)}, (_, i) =>
        array.slice(i * size, i * size + size)
    );
};

export const flatten = (arrays) => Array.isArray(arrays) ? arrays.flat() : [];
export const flattenDeep = (arr) => arr.reduce((acc, v) =>
    acc.concat(Array.isArray(v) ? flattenDeep(v) : v), []);

export const unique = (arr) => [...new Set(arr)];

export const partition = (array, predicate) => {
    if (!Array.isArray(array)) {
        return [[], []];
    }
    return array.reduce((acc, item) => {
        acc[predicate(item) ? 0 : 1].push(item);
        return acc;
    }, [[], []]);
};

export const sum = (values) => Array.isArray(values) ? values.reduce((acc, val) => acc + val, 0) : 0;
export const min = (values) => Array.isArray(values) && values.length > 0 ? Math.min(...values) : Infinity;
export const max = (values) => Array.isArray(values) && values.length > 0 ? Math.max(...values) : -Infinity;

export const calculateAverage = (values) => {
    const {mean} = Statistics.meanMedianStd(values);
    return mean;
};

export const calculateStatistics = (values) => {
    if (!Array.isArray(values) || values.length === 0) {
        return {mean: 0, median: 0, std: 0, min: 0, max: 0, count: 0};
    }
    const {mean, median, stdDev} = Statistics.meanMedianStd(values);
    return {
        mean,
        median,
        std: stdDev,
        min: min(values),
        max: max(values),
        count: values.length,
        variance: stdDev * stdDev
    };
};

export const getPercentile = (values, percentile) => {
    if (!Array.isArray(values) || values.length === 0) {
        return 0;
    }
    return Statistics.quantile(values, percentile);
};

export const getOutliers = (values, threshold = 2) => {
    if (!Array.isArray(values) || values.length === 0) {
        return [];
    }
    const {mean, stdDev} = Statistics.meanMedianStd(values);
    return values.filter(value => Math.abs(value - mean) > threshold * stdDev);
};

export const correlation = (values1, values2) => {
    if (!Array.isArray(values1) || !Array.isArray(values2) || values1.length !== values2.length || values1.length === 0) {
        return 0;
    }
    const {mean: avg1} = Statistics.meanMedianStd(values1);
    const {mean: avg2} = Statistics.meanMedianStd(values2);
    const diffs = values1.map((val, i) => ({diff1: val - avg1, diff2: values2[i] - avg2}));
    const numerator = diffs.reduce((s, {diff1, diff2}) => s + diff1 * diff2, 0);
    const sumSq1 = diffs.reduce((s, {diff1}) => s + diff1 * diff1, 0);
    const sumSq2 = diffs.reduce((s, {diff2}) => s + diff2 * diff2, 0);
    const denominator = Math.sqrt(sumSq1 * sumSq2);
    return denominator === 0 ? 0 : numerator / denominator;
};
