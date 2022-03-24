/// <reference path="api.d.ts" />

import { Node } from './node.js';
import { Message } from './message.js';
import type { Nodes, NodeId } from './node.js';
import { Updatable } from './updatable.js';


interface Executor {
  (promise: Promise<unknown>): void;
}

const DefaultExecutor: Executor = (promise: Promise<unknown>) => {
  promise.catch((err) => {
    console.error(err);
  });
}


export type ScreenId = number;

export class Manager<Data, Info> extends Updatable {
  _channel: BroadcastChannel;
  #controlledScreens = false;
  _nodes: Nodes<Data, Info> = {};
  _screenDetails: ScreenDetails | null = null;

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

    this._addNode(this.self);

    // this.#idMap[this.self[NodeIdSymbol]] = this.self.id;

    this._channel = new BroadcastChannel(options?.channelName ?? 'window-control');
  }

  get nodes(): Array<Node<Data, Info>> {
    return Object.values(this._nodes);
  }

  get orphanNodes(): Nodes<Data, Info> {
    return Object.fromEntries(
      Object.entries(this._nodes).filter(([_id, node]) => node.parent === null)
    );
  }


  // Frozen

  private _addNode(node: Node<Data, Info>) {
    this._nodes[node.id] = node;
  }

  private _removeNode(nodeArg: Node<Data, Info> | NodeId) {
    let node = typeof nodeArg === 'object'
      ? nodeArg
      : this._nodes[nodeArg];

    delete this._nodes[node.id];
  }

  // -


  _send(message: Message<Data, Info>) {
    this._channel.postMessage(JSON.stringify(message));
  }


  async start(options?: { signal?: AbortSignal; }) {
    this._channel.addEventListener('message', (event) => {
      let message = JSON.parse(event.data) as Message<Data, Info>;

      switch (message.type) {
        // A new node declares itself.
        case 'declare': {
          let node = Node.fromSerialized(this, message.node);
          this._addNode(node);

          this._send({
            type: 'info',
            node: this.self.serialize()
          });

          this._update();

          break;
        }

        // Other nodes provide information after we declared ourselves.
        case 'info': {
          if (!(message.node.id in this._nodes)) {
            let node = Node.fromSerialized(this, message.node);
            this._addNode(node);
            this._update();
          }

          break;
        }

        // A node is closed.
        case 'close': {
          let node = this._nodes[message.id];
          this._removeNode(node);

          // If this node is our parent
          if (this.self.parent === node) {
            this.self._data.parentId = null;
            this.self._update();
          }

          this._update();

          break;
        }

        // A node is ordered to close.
        case 'order-close': {
          let node = this._nodes[message.id];

          if (node === this.self) {
            window.close();
          }

          break;
        }

        // A node's data changes.
        case 'update': {
          let node = this._nodes[message.id];

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

    // Notify other clients when this node is closed.
    window.addEventListener('beforeunload', () => {
      controller.abort();

      this._send({
        type: 'close',
        id: this.self.id
      });
    }, { signal: controller.signal });


    // Observe visibility changes of this window.
    document.addEventListener('visibilitychange', () => {
      this.self._data.visible = (document.visibilityState === 'visible');
      this.self._updateAndBroadcast();
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
    this._send({
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
        if (!this._screenDetails) {
          this._screenDetails = await window.getScreenDetails();

          this._screenDetails.addEventListener('screenschange', () => {
            updateCurrentScreen();
          });

          this._screenDetails.addEventListener('currentscreenchange', () => {
            updateCurrentScreen();
          });

          updateCurrentScreen();
        }
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
