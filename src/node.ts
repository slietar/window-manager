import { NodesInternalSymbol, SendSymbol } from './manager.js';
import type { Manager } from './manager.js';
import type { SerializedNode } from './message.js';
import { Updatable } from './updatable.js';


export type NodeId = symbol;
export type NodeIdInternal = string;
export type Nodes<Data, Info> = Record<NodeId, Node<Data, Info>>;

export const NodeIdInternalSymbol = Symbol();
export const SetDataSymbol = Symbol();


// export class Node<Info extends Object = {}, Data extends object = {}> {
export class Node<Data, Info> extends Updatable {
  #id: NodeIdInternal;
  #manager: Manager<Data, Info>;

  // data: changes
  #data: {
    parentId: NodeIdInternal | null;
    screenId: NodeIdInternal | null;

    focused: boolean;
    visible: boolean;

    user: Data;
  };

  // info: doesn't change
  #info: {
    controlled: boolean;
    popup: boolean;
    user: Info;
  };

  readonly id: NodeId;
  readonly window: Window | null;

  private constructor(manager: Manager<Data, Info>, options: {
    id: NodeIdInternal;
    data: {
      parentId: NodeIdInternal | null;
      screenId: NodeIdInternal | null;

      focused: boolean;
      visible: boolean;

      user: Data;
    };
    info: {
      controlled: boolean;
      popup: boolean;
      user: Info;
    };
    window: Window | null;
  }) {
    super();

    this.#data = options.data;
    this.#id = options.id;
    this.#info = options.info;
    this.#manager = manager;

    this.id = Symbol(this.#id);
    this.window = options.window;
  }

  get data(): Data { return this.#data.user; }
  get controlled(): boolean { return this.#info.controlled; }
  get popup(): boolean { return this.#info.popup };

  get info(): Info { return this.#info.user; }
  get focused(): boolean { return this.#data.focused; }
  get visible(): boolean { return this.#data.visible; }

  get parent(): Node<Data, Info> | null {
    return this.#data.parentId
      ? this.#manager[NodesInternalSymbol][this.#data.parentId]
      : null;
  }

  get children(): Record<NodeId, Node<Data, Info>> {
    return Object.fromEntries(
      Object.entries(this.#manager[NodesInternalSymbol]).filter(([_id, node]) =>
        node.parent === this
      )
    );
  }

  get [NodeIdInternalSymbol](): NodeIdInternal {
    return this.#id;
  }

  [SetDataSymbol](data: Partial<SerializedNode<Data, never>['data']>, options?: { update?: boolean; }) {
    Object.assign(this.#data, data);
    this._update();

    if (options?.update) {
      this.#manager[SendSymbol]({
        type: 'update',
        id: this.#id,
        data: this.#data
      });
    }
  }


  close() {
    if (this.window) {
      this.window.close();
    } else {
      this.#manager[SendSymbol]({
        type: 'order-close',
        id: this.#id
      });
    }
  }

  setData(data: Partial<Data>) {
    this[SetDataSymbol]({ user: { ...this.#data.user, ...data } }, { update: true });
  }

  serialize(): SerializedNode<Data, Info> {
    return {
      id: this.#id,
      data: this.#data,
      info: this.#info
    };
  }

  // start(options?: { signal: AbortSignal }) { }


  static fromRef<Data, Info>(
    manager: Manager<Data, Info>,
    document: Document,
    window: Window,
    options: {
      data: Data;
      info: Info;
    }
  ): Node<Data, Info> {
    let node = new Node(manager, {
      id: createId(),
      data: {
        parentId: null,
        screenId: null,

        focused: document.hasFocus(),
        visible: (document.visibilityState === 'visible'),

        user: options.data
      },
      info: {
        controlled: window.opener !== null,
        popup: !window.locationbar.visible,
        user: options.info
      },
      window
    });

    return node;
  }

  static fromSerialized<Data, Info>(manager: Manager<Data, Info>, node: SerializedNode<Data, Info>): Node<Data, Info> {
    return new Node(manager, {
      ...node,
      window: null
    });
  }
}

function createId(): NodeIdInternal {
  return (Math.random() + 1).toString(36).substring(7);
}
