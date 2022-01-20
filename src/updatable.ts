export type UpdateListener<T> = (arg: T | void) => void;

export class Updatable<T = void> {
  #listeners: Set<UpdateListener<T>> = new Set();

  onUpdate(listener: UpdateListener<T>, options?: { initial?: boolean; signal?: AbortSignal }) {
    this.#listeners.add(listener);

    options?.signal?.addEventListener('abort', () => {
      this.#listeners.delete(listener);
    }, { once: true });

    if (options?.initial) {
      requestAnimationFrame(() => {
        listener();
      });
    }
  }

  offUpdate(listener: UpdateListener<T>) {
    this.#listeners.delete(listener);
  }

  protected _update(arg: T) {
    for (let listener of this.#listeners) {
      requestAnimationFrame(() => {
        listener.call(this, arg);
      });
    }
  }
}
