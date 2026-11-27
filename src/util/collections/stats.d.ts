/**
 * What a bounded store reports about itself. The archive, the link layers, and the
 * statistics port each spelled this triple inline, so a report could not be read
 * without trusting that the writer meant `size` against the same `capacity` the
 * `utilization` was taken over.
 */
export type ContainerStats = {
    size: number;
    capacity: number;
    utilization: number;
};
/** {@link ContainerStats} from one size reading and one capacity. */
export declare const containerStats: (size: number, capacity: number) => ContainerStats;
//# sourceMappingURL=stats.d.ts.map