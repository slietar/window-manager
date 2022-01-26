import { Node, NodeIdInternalSymbol, SetDataSymbol } from './node.js';
import { Message } from './message.js';
import type { Nodes, NodeId, NodeIdInternal } from './node.js';
import { Updatable } from './updatable.js';


declare global {
  interface Window {
    getScreenDetails(): Promise<ScreenDetails>;
  }

  interface ScreenDetails {
    currentScreen: ScreenDetailed;
    screens: ScreenDetailed[];
  }

  interface ScreenDetailed extends Screen {
    devicePixelRatio: number;
    label: string;
    left: number;
    top: number;
  }
}


interface Executor {
  (promise: Promise<unknown>): void;
}

const DefaultExecutor: Executor = (promise: Promise<unknown>) => {
  promise.catch((err) => {
    console.error(err);
  });
}



export type ScreenId = number;

export const NodesInternalSymbol = Symbol();
export const SendSymbol = Symbol();

export class Manager<Data, Info> extends Updatable {
  #channel: BroadcastChannel;
  #controlledScreens = false;
  #nodes: Record<NodeIdInternal, Node<Data, Info>> = {};
  _screenDetails: ScreenDetails | null = null;

  readonly nodes: Record<NodeId, Node<Data, Info>> = {};
  readonly self: Node<Data, Info>;

  constructor(options?: {
    channelName?: string;

    data?: Data;
    info?: Info;
  }) {
    super();

    this.self = Node.fromRef(this, document, window, {
      data: options?.data ?? ({} as Data),
      info: options?.info ?? ({} as Info)
    });

    this.#addNode(this.self);

    // this.#idMap[this.self[NodeIdSymbol]] = this.self.id;

    this.#channel = new BroadcastChannel(options?.channelName ?? 'window-control');
  }

  get [NodesInternalSymbol]() {
    return this.#nodes;
  }

  get nodeList(): Array<Node<Data, Info>> {
    return Object.values(this.#nodes);
  }

  get orphanNodes(): Nodes<Data, Info> {
    return Object.fromEntries(
      Object.entries(this.#nodes).filter(([_id, node]) => node.parent === null)
    );
  }


  // Frozen

  #addNode(node: Node<Data, Info>) {
    this.#nodes[node[NodeIdInternalSymbol]] = node;
    this.nodes[node.id] = node;
  }

  #removeNode(nodeArg: Node<Data, Info> | NodeId) {
    let node = typeof nodeArg === 'object'
      ? nodeArg
      : this.nodes[nodeArg];

    delete this.#nodes[node[NodeIdInternalSymbol]];
    delete this.nodes[node.id];
  }

  // -


  #send(message: Message<Data, Info>) {
    this.#channel.postMessage(JSON.stringify(message));
  }

  [SendSymbol](message: Message<Data, Info>) {
    this.#send(message);
  }


  async start(options?: { signal?: AbortSignal; }) {
    this.#channel.addEventListener('message', (event) => {
      let message = JSON.parse(event.data) as Message<Data, Info>;

      switch (message.type) {
        case 'declare': {
          let node = Node.fromSerialized(this, message.node);
          this.#addNode(node);

          // if (node.parent === this.self) {
          //   let index = this._childrenRefs.findIndex((ref) => ref.__info.id === window.id);

          //   if (index >= 0) {
          //     window.ref = this._childrenRefs[index];
          //     this._childrenRefs.splice(index, 1);
          //   }
          // }

          this.#send({
            type: 'info',
            node: this.self.serialize()
          });

          this._update();

          break;
        }

        case 'info': {
          if (!(message.node.id in this.#nodes)) {
            let node = Node.fromSerialized(this, message.node);
            this.#addNode(node);
            this._update();
          }

          break;
        }

        case 'close': {
          let node = this.#nodes[message.id];

          if (this.self.parent === node) {
            this.self._data.parentId = null;
            this.self._update();
            this._update();
          }

          this.#removeNode(node);

          // if (this.children.has(closedWindow)) {
          //   this.children.delete(closedWindow);
          // }

          this._update();

          break;
        }

        case 'order-close': {
          let node = this.#nodes[message.id];

          if (node === this.self) {
            window.close();
          }

          break;
        }

        case 'update': {
          let node = this.#nodes[message.id];

          node._data = message.data;
          node._update();
          this._update();

          break;
        }
      }
    }, { signal: options?.signal });


    let controller = new AbortController();

    options?.signal?.addEventListener('abort', () => {
      controller.abort();
    }, { once: true });

    // Notify other clients when this window is closed.
    window.addEventListener('beforeunload', (event) => {
      // unloading = true;
      controller.abort();

      this.#send({
        type: 'close',
        id: this.self[NodeIdInternalSymbol]
      });
    }, { signal: controller.signal });


    // Observe visibility changes of this window.
    document.addEventListener('visibilitychange', () => {
      this.self._data.visible = (document.visibilityState === 'visible');
      this.self._updateAndBroadcast();

      // if (!unloading) {
      // }
    }, { signal: controller.signal });


    // Observe focus changes of this window.
    window.addEventListener('focus', () => {
      this.self._data.focused = true;
      this.self._updateAndBroadcast();
    }, { signal: controller.signal });

    window.addEventListener('blur', () => {
      this.self._data.focused = false;
      this.self._updateAndBroadcast();
    }, { signal: controller.signal });


    // Notify existing nodes of this new node.
    this.#send({
      type: 'declare',
      node: this.self.serialize()
    });


    // Query the Screen Control API
    await this.controlScreens();
  }

  open(options?: { popup: boolean; }) {
    let ref = window.open(location.href, '', options?.popup ? 'popup' : '');
    // this._childrenRefs.push(ref);
  }


  async controlScreens(options?: { executor?: Executor; signal?: AbortSignal; }) {
    this.#controlledScreens = false;

    let permission!: PermissionStatus;

    try {
      permission = await navigator.permissions.query({ name: 'window-placement' as PermissionName });
    } catch (err) {
      // Not supported
      return;
    }


    let updateCurrentScreen = () => {
      this.self._data.screenId = this._screenDetails
        && this._screenDetails.screens.indexOf(this._screenDetails.currentScreen);
      this.self._updateAndBroadcast();
    };

    let update = async () => {
      if (permission.state === 'granted') {
        this._screenDetails = await window.getScreenDetails();
        updateCurrentScreen();
      } else {
        this._screenDetails = null;
        updateCurrentScreen();
      }
    };

    await update();

    permission.addEventListener('change', () => {
      (options?.executor ?? DefaultExecutor)(update());
    }, { signal: options?.signal });
  }
}
