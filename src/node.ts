import { NodesInternalSymbol, SendSymbol } from './manager.js';
import type { Manager, ScreenId } from './manager.js';
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
  _data: {
    parentId: NodeIdInternal | null;
    screenId: ScreenId | null;

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
      screenId: ScreenId | null;

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

    this._data = options.data;
    this.#id = options.id;
    this.#info = options.info;
    this.#manager = manager;

    this.id = Symbol(this.#id);
    this.window = options.window;
  }

  get stringId(): string { return this.#id; }

  get data(): Data { return this._data.user; }
  get controlled(): boolean { return this.#info.controlled; }
  get popup(): boolean { return this.#info.popup };

  get info(): Info { return this.#info.user; }
  get focused(): boolean { return this._data.focused; }
  get visible(): boolean { return this._data.visible; }

  get screen(): ScreenDetailed | null {
    return this.#manager._screenDetails && this._data.screenId !== null
      ? this.#manager._screenDetails.screens[this._data.screenId]
      : null;
  }

  get parent(): Node<Data, Info> | null {
    return this._data.parentId
      ? this.#manager[NodesInternalSymbol][this._data.parentId]
      : null;
  }

  get children(): Record<NodeId, Node<Data, Info>> {
    return Object.fromEntries(
      Object.entries(this.#manager[NodesInternalSymbol]).filter(([_id, node]) =>
        node.parent === this
      )
    );
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
    Object.assign(this._data.user, data);
    this._updateAndBroadcast();
  }

  serialize(): SerializedNode<Data, Info> {
    return {
      id: this.#id,
      data: this._data,
      info: this.#info
    };
  }


  _broadcast() {
    this.#manager[SendSymbol]({
      type: 'update',
      id: this.#id,
      data: this._data
    });
  }

  _updateAndBroadcast() {
    this._update();
    this._broadcast();
    this.#manager._update();
  }

  get [NodeIdInternalSymbol](): NodeIdInternal {
    return this.#id;
  }


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
