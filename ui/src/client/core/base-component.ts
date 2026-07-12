import { LitElement } from 'lit';

type Unsubscriber = () => void;

export class BaseComponent extends LitElement {
  private unsubs: Unsubscriber[] = [];

  override disconnectedCallback(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    super.disconnectedCallback();
  }

  protected watch(source: { subscribe(fn: () => void): Unsubscriber }): void {
    this.unsubs.push(source.subscribe(() => this.requestUpdate()));
  }

  protected watchWith<T>(
    source: { subscribe(fn: (v: T) => void): Unsubscriber; get(): T },
    fn: (v: T) => void
  ): void {
    fn(source.get());
    this.unsubs.push(source.subscribe(fn));
  }
}
