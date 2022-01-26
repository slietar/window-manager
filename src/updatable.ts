export type UpdateListener<T> = (arg: T | void) => void;

export class Updatable<T = void, Opts extends object = {}> {
  #listeners: Set<UpdateListener<T>> = new Set();
  #triggered: boolean = false;

  onUpdate(listener: UpdateListener<T>, options?: { initial?: boolean; signal?: AbortSignal } & Opts) {
    this.#listeners.add(listener);

    options?.signal?.addEventListener('abort', () => {
      this.#listeners.delete(listener);
    }, { once: true });

    if (options?.initial && !this.#triggered) {
      requestAnimationFrame(() => {
        listener();
      });
    }
  }

  offUpdate(listener: UpdateListener<T>) {
    this.#listeners.delete(listener);
  }

  /* protected */ _update(arg: T) {
    if (!this.#triggered) {
      this.#triggered = true;

      for (let listener of this.#listeners) {
        requestAnimationFrame(() => {
          this.#triggered = false;
          listener.call(this, arg);
        });
      }
    }
  }
}
