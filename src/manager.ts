import { Node, NodeIdInternalSymbol, SetDataSymbol } from './node.js';
import { Message } from './message.js';
import type { Nodes, NodeId, NodeIdInternal } from './node.js';
import { Updatable } from './updatable.js';


export const NodesInternalSymbol = Symbol();
export const SendSymbol = Symbol();

export class Manager<Data, Info> extends Updatable {
  #channel: BroadcastChannel;
  #nodes: Record<NodeIdInternal, Node<Data, Info>> = {};

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


  start(options?: { signal?: AbortSignal; }) {
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
            this.self[SetDataSymbol]({ parentId: null });
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

          node[SetDataSymbol](message.data);
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
      this.self[SetDataSymbol]({ visible: (document.visibilityState === 'visible') }, { update: true });
      this._update();

      // if (!unloading) {
      // }
    }, { signal: controller.signal });


    // Observe focus changes of this window.
    window.addEventListener('focus', () => {
      this.self[SetDataSymbol]({ focused: true }, { update: true });
      this._update();
    }, { signal: controller.signal });

    window.addEventListener('blur', () => {
      this.self[SetDataSymbol]({ focused: false }, { update: true });
      this._update();
    }, { signal: controller.signal });


    // Notify existing nodes of this new node.
    this.#send({
      type: 'declare',
      node: this.self.serialize()
    });
  }

  open(options?: { popup: boolean; }) {
    let ref = window.open(location.href, '', options?.popup ? 'popup' : '');
    // this._childrenRefs.push(ref);
  }
}
