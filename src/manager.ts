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

export type ScreenId = string;

export interface Screen extends ScreenDetailed {
  id: ScreenId;
  isCurrent: boolean;
}


export interface MethodsBuiltin {
  _focus(): void;
  _moveTo(x: number, y: number): void;
  _requestFullscreen(options: FullscreenOptions): void;
  _resizeTo(width: number, height: number): void;
}

export type MethodsBase = Record<string, (...args: any[]) => void>;

export class Manager<Data, Info, Methods extends MethodsBase> extends Updatable {
  _channel: BroadcastChannel;
  _methods: Methods & MethodsBuiltin;
  _nodes: Nodes<Data, Info, Methods> = {};

  screenDetails: ScreenDetails | null = null;
  screensById: Record<Screen['id'], Screen> | null = null;

  readonly self: Node<Data, Info, Methods>;

  constructor(options?: {
    channelName?: string;

    data?: Data;
    info?: Info;

    methods?: Methods;
  }) {
    super();

    this._channel = new BroadcastChannel(options?.channelName ?? 'window-control');
    this._methods = {
      ...options?.methods,
      _focus() {
        window.focus();
      },
      _moveTo(x: number, y: number) {
        window.moveTo(x, y);
      },
      _requestFullscreen(options: FullscreenOptions) {
        document.body.requestFullscreen(options);
      },
      _resizeTo(width: number, height: number) {
        window.resizeTo(width, height);
      }
    } as unknown as (Methods & MethodsBuiltin);

    this.self = Node.fromRef(this, document, window, {
      data: options?.data ?? ({} as Data),
      info: options?.info ?? ({} as Info)
    });

    this._addNode(this.self);
  }

  get nodes(): Array<Node<Data, Info, Methods>> {
    return Object.values(this._nodes);
  }

  get nodesById(): Nodes<Data, Info, Methods> {
    return this._nodes;
  }

  get orphanNodes(): Nodes<Data, Info, Methods> {
    return Object.fromEntries(
      Object.entries(this._nodes).filter(([_id, node]) => node.parent === null)
    );
  }

  get screens(): Array<Screen> | null {
    return this.screensById && Object.values(this.screensById);
  }


  // Frozen

  private _addNode(node: Node<Data, Info, Methods>) {
    this._nodes[node.id] = node;
  }

  private _removeNode(nodeArg: Node<Data, Info, Methods> | NodeId) {
    let node = typeof nodeArg === 'object'
      ? nodeArg
      : this._nodes[nodeArg];

    delete this._nodes[node.id];
  }

  // -


  _send(message: Message<Data, Info>) {
    this._channel.postMessage(message);
  }


  async start(options?: { signal?: AbortSignal; }) {
    this._channel.addEventListener('message', (event) => {
      let message = event.data as Message<Data, Info>;

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

        // A method is triggered.
        case 'method': {
          let node = this._nodes[message.id];

          if (node === this.self) {
            this._methods[message.name].call(node, ...message.args);
          }

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

    // Observe fullscreen changes for this window.
    document.addEventListener('fullscreenchange', () => {
      this.self._data.fullscreen = (document.fullscreenElement !== null);
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

  open(options: {
    x?: number;
    y?: number;

    popup?: boolean;
    screen?: Screen;

    width?: number;
    height?: number;
  } = {}) {
    let features = [];

    if (options.x || options.screen) {
      features.push(`left=${(options.screen?.left ?? 0) + (options.x ?? 0)}`);
    }

    if (options.y || options.screen) {
      features.push(`top=${(options.screen?.top ?? 0) + (options.y ?? 0)}`);
    }

    if (options.width) {
      features.push(`width=${options.width}`);
    }

    if (options.height) {
      features.push(`height=${options.height}`);
    }

    if (options.popup) {
      features.push(`popup`);
    }

    let _ref = window.open(location.href, 'Xxx', features.join(','));
  }


  async controlScreens(options?: { executor?: Executor; signal?: AbortSignal; }) {
    let permission!: PermissionStatus;

    try {
      permission = await navigator.permissions.query({ name: 'window-placement' as PermissionName });
    } catch (err) {
      // Not supported
      return;
    }


    let updateScreens = () => {
      let screenDetails = this.screenDetails!;

      this.screensById = Object.fromEntries(
        screenDetails.screens.map((screenDetailed) => {
          let id = hash([screenDetailed.width, screenDetailed.height, screenDetailed.isInternal, screenDetailed.colorDepth, screenDetailed.devicePixelRatio]);

          return [id, {
            id,
            label: screenDetailed.label,

            availWidth: screenDetailed.availWidth,
            availHeight: screenDetailed.availHeight,
            width: screenDetailed.width,
            height: screenDetailed.height,

            left: screenDetailed.left,
            top: screenDetailed.top,

            colorDepth: screenDetailed.colorDepth,
            devicePixelRatio: screenDetailed.devicePixelRatio,
            orientation: screenDetailed.orientation,
            pixelDepth: screenDetailed.pixelDepth,

            get isCurrent() {
              return screenDetailed === screenDetails.currentScreen;
            },
            isExtended: screenDetailed.isExtended,
            isInternal: screenDetailed.isInternal,
            isPrimary: screenDetailed.isPrimary
          }];
        })
      );
    };

    let updateCurrentScreen = () => {
      this.self._data.screenId = this.screens?.find((screen) => screen.isCurrent)?.id ?? null;
      this.self._updateAndBroadcast();
    };

    let updatePermission = async () => {
      if (permission.state === 'granted') {
        if (!this.screenDetails) {
          this.screenDetails = await window.getScreenDetails();

          this.screenDetails.addEventListener('screenschange', () => {
            updateScreens();
            updateCurrentScreen();
          });

          this.screenDetails.addEventListener('currentscreenchange', () => {
            updateCurrentScreen();
          });

          updateScreens();
          updateCurrentScreen();
        }
      } else {
        this.screenDetails = null;
        this.screensById = null;

        updateCurrentScreen();
      }
    };

    await updatePermission();

    permission.addEventListener('change', () => {
      (options?.executor ?? DefaultExecutor)(updatePermission());
    }, { signal: options?.signal });
  }
}


function hash(input: (boolean | number)[]): string {
  let output = 0;

  for (let item of input) {
    output = ((output << 5) - output) + Number(item);
    output = output & output;
  }

  return Math.abs(output).toString(16);
}
