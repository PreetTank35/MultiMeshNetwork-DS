/**
 * Generic Binary Min-Heap Priority Queue
 * Provides O(log n) push/pop for discrete-event scheduling and Dijkstra pathfinding.
 */

export class MinHeap<T> {
  private heap: T[] = [];

  constructor(private readonly compare: (a: T, b: T) => number) {}

  public get size(): number {
    return this.heap.length;
  }

  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  public peek(): T | undefined {
    return this.heap[0];
  }

  public push(item: T): void {
    this.heap.push(item);
    this.siftUp(this.heap.length - 1);
  }

  public pop(): T | undefined {
    const n = this.heap.length;
    if (n === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (n > 1) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  public clear(): void {
    this.heap = [];
  }

  /**
   * Returns a shallow copy of the heap array in internal heap order.
   */
  public toArray(): T[] {
    return [...this.heap];
  }

  private siftUp(index: number): void {
    let idx = index;
    const item = this.heap[idx];
    while (idx > 0) {
      const parentIdx = (idx - 1) >> 1;
      const parent = this.heap[parentIdx];
      if (this.compare(item, parent) >= 0) break;
      this.heap[idx] = parent;
      idx = parentIdx;
    }
    this.heap[idx] = item;
  }

  private siftDown(index: number): void {
    let idx = index;
    const length = this.heap.length;
    const item = this.heap[idx];

    while (true) {
      const leftIdx = (idx << 1) + 1;
      if (leftIdx >= length) break;

      const rightIdx = leftIdx + 1;
      let smallestIdx = leftIdx;

      if (rightIdx < length && this.compare(this.heap[rightIdx], this.heap[leftIdx]) < 0) {
        smallestIdx = rightIdx;
      }

      if (this.compare(this.heap[smallestIdx], item) >= 0) break;

      this.heap[idx] = this.heap[smallestIdx];
      idx = smallestIdx;
    }

    this.heap[idx] = item;
  }
}
