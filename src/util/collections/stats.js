import { occupancy } from '../numeric';
/** {@link ContainerStats} from one size reading and one capacity. */
export const containerStats = (size, capacity) => ({
    size,
    capacity,
    utilization: occupancy(size, capacity),
});
