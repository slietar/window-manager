import type { Manager, MethodsBase, ScreenId } from './manager.js';
import type { SerializedNode } from './message.js';
import { Updatable } from './updatable.js';


export type NodeId = string;
export type Nodes<Data, Info, Methods extends MethodsBase> = Record<NodeId, Node<Data, Info, Methods>>;

export class Node<Data, Info, Methods extends MethodsBase> extends Updatable {
  _manager: Manager<Data, Info, Methods>;
  _data: {
    parentId: NodeId | null;
    screenId: ScreenId | null;

    focused: boolean;
    fullscreen: boolean;
    visible: boolean;

    user: Data;
  };
  _info: {
    controlled: boolean;
    popup: boolean;
    user: Info;
  };

  readonly id: NodeId;
  readonly methods: Methods;
  readonly window: Window | null;

  private constructor(manager: Manager<Data, Info, Methods>, options: {
    id: NodeId;
    data: {
      parentId: NodeId | null;
      screenId: ScreenId | null;

      focused: boolean;
      fullscreen: boolean;
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
    this._info = options.info;
    this._manager = manager;

    this.id = options.id;
    this.window = options.window;

    this.methods = Object.fromEntries(
      Object.entries(manager._methods).map(([name, method]) => {
        return [name, (...args: any[]) => {
          if (this === manager.self) {
            method.call(this, ...args);
          } else {
            this._manager._send({
              type: 'method',
              id: this.id,
              name,
              args
            });
          }
        }];
      })
    ) as Methods;
  }

  get data(): Data { return this._data.user; }
  get controlled(): boolean { return this._info.controlled; }
  get popup(): boolean { return this._info.popup };

  get info(): Info { return this._info.user; }
  get focused(): boolean { return this._data.focused; }
  get fullscreen(): boolean { return this._data.fullscreen; }
  get visible(): boolean { return this._data.visible; }

  get screen(): ScreenDetailed | null {
    return this._manager.screenDetails && this._data.screenId !== null
      ? this._manager.screenDetails.screens[this._data.screenId]
      : null;
  }

  get parent(): Node<Data, Info, Methods> | null {
    return this._data.parentId
      ? this._manager._nodes[this._data.parentId]
      : null;
  }

  get children(): Record<NodeId, Node<Data, Info, Methods>> {
    return Object.fromEntries(
      Object.entries(this._manager.nodes).filter(([_id, node]) =>
        node.parent === this
      )
    );
  }


  close() {
    if (this.window) {
      this.window.close();
    } else {
      this._manager._send({
        type: 'order-close',
        id: this.id
      });
    }
  }

  focus() {
    this.methods._focus();
  }

  moveTo(x: number, y: number) {
    this.methods._moveTo(x, y);
  }

  moveToScreen(screen: ScreenDetailed, x: number, y: number) {
    this.moveTo(x + screen.left, y + screen.top);
  }

  requestFullscreen(options?: FullscreenOptions) {
    this.methods._requestFullscreen(options ?? {});
  }

  resizeTo(width: number, height: number) {
    this.methods._resizeTo(width, height);
  }

  setData(data: Partial<Data>) {
    Object.assign(this._data.user, data);
    this._updateAndBroadcast();
  }

  serialize(): SerializedNode<Data, Info> {
    return {
      id: this.id,
      data: this._data,
      info: this._info
    };
  }


  _broadcast() {
    this._manager._send({
      type: 'update',
      id: this.id,
      data: this._data
    });
  }

  _updateAndBroadcast() {
    this._update();
    this._broadcast();
    this._manager._update();
  }


  static fromRef<Data, Info, Methods extends MethodsBase>(
    manager: Manager<Data, Info, Methods>,
    document: Document,
    window: Window,
    options: {
      data: Data;
      info: Info;
    }
  ): Node<Data, Info, Methods> {
    let node = new Node(manager, {
      id: createId(),
      data: {
        parentId: null,
        screenId: null,

        focused: document.hasFocus(),
        fullscreen: document.fullscreenElement !== null,
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

  static fromSerialized<Data, Info, Methods extends MethodsBase>(manager: Manager<Data, Info, Methods>, node: SerializedNode<Data, Info>): Node<Data, Info, Methods> {
    return new Node(manager, {
      ...node,
      window: null
    });
  }
}


function createId(): NodeId {
  return (Math.random() + 1).toString(36).substring(7);
}
