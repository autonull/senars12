export interface BagItem<T> {
  item: T;
  priority: number;
  lastAccess: number;
  createdAt: number;
}
