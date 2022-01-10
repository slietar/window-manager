class Manager {
  constructor(options = {}) {
    this._channel = new BroadcastChannel(options.channelName ?? 'window-control');
    this._listener = options.listener;

    this.windows = {};
    this.self = this._newWindow({
      id: options.id ?? getId(),
      controlled: window.opener !== null,
      data: {
        parentId: null,
        screenId: null,
        state: document.visibilityState
      },
      info: {
        controlled: window.opener !== null,
        popup: !window.locationbar.visible
      },
      ref: window
    });

    this.children = new Set();
    this.screenDetails = null;

    this._childrenRefs = [];

    document.title = this.self.id.toUpperCase();
  }

  _newWindow(options) {
    let that = this;

    let win = {
      ref: null,
      ...options,
      close: options.controlled
        ? () => {
          if (win.ref) {
            win.ref.close();
          } else {
            this._channelSend({ type: 'order-close', id: win.id });
          }
        }
        : null,
      get parent() {
        return that.windows[win.data.parentId];
      },
      get screen() {
        return that.screenDetails?.screens[win.data.screenId];
      }
    };

    this.windows[win.id] = win;
    return win;
  }

  // Notify other windows
  _notify() {
    this._channelSend({
      type: 'update',
      id: this.self.id,
      data: this.self.data
    });
  }

  // Notify the client
  _update() {
    requestAnimationFrame(() => {
      this._listener?.();
    });
  }


  get parent() {
    return this.self.parent;
  }

  open(options = {}) {
    let ref = window.open(location.href, '', options.popup ? 'popup' : '');
    this._childrenRefs.push(ref);
  }

  async start() {
    window.__info = this.self;

    if (window.opener) {
      let parent = this._newWindow(window.opener.__info);
      this.self.data.parentId = parent.id;
    }

    this._channel.addEventListener('message', (event) => {
      let message = JSON.parse(event.data);

      switch (message.type) {
        case 'declare': {
          let window = this._newWindow(message.window);

          if (window.parent === this.self) {
            this.children.add(window);

            let index = this._childrenRefs.findIndex((ref) => ref.__info.id === window.id);

            if (index >= 0) {
              window.ref = this._childrenRefs[index];
              this._childrenRefs.splice(index, 1);
            }
          }

          this._channelSend({
            type: 'info',
            window: {
              id: this.self.id,
              controlled: this.self.controlled,
              data: this.self.data,
              info: this.self.info
            }
          });

          this._update();

          break;
        }

        case 'info': {
          if (!(message.window.id in this.windows)) {
            this._newWindow(message.window);
            this._update();
          }

          break;
        }

        case 'close': {
          let closedWindow = this.windows[message.id];

          if (this.self.parent === closedWindow) {
            this.self.data.parentId = null;
            this._notify();
          }

          delete this.windows[closedWindow.id];

          if (this.children.has(closedWindow)) {
            this.children.delete(closedWindow);
          }

          this._update();

          break;
        }

        case 'order-close': {
          if (message.id === this.self.id) {
            window.close();
          }

          break;
        }

        case 'update': {
          this.windows[message.id].data = message.data;
          this._update();

          break;
        }
      }
    });


    let unloading = false;

    window.addEventListener('beforeunload', (event) => {
      unloading = true;

      this._channelSend({
        type: 'close',
        id: this.self.id
      });
    });

    await this.screenInit();

    this._channelSend({
      type: 'declare',
      window: {
        id: this.self.id,
        controlled: this.self.controlled,
        data: this.self.data,
        info: this.self.info
      }
    });





    // Lifecycle API

    document.addEventListener('visibilitychange', () => {
      if (!unloading) {
        this.self.data.state = document.visibilityState;
        this._notify();
      }
    });


    this._update();
  }

  async screenInit() {
    this.screenGranted = false;
    this.screenSupported = false;

    let permission;

    try {
      permission = await navigator.permissions.query({ name: 'window-placement' });
    } catch (err) {
      return;
    }

    let update = async () => {
      this.screenGranted = (permission.state === 'granted');
      // console.log(this.screenSupported, this.screenGranted);

      if (this.screenGranted) {
        await this.screenAsk();
      }
    };

    this.screenSupported = true;
    await update();

    permission.addEventListener('change', () => {
      update();
    });
  }

  async screenAsk() {
    let details = await window.getScreenDetails();
    this.screenDetails = details;

    this.self.data.screenId = details.screens.indexOf(details.currentScreen);
  }

  _channelSend(message) {
    this._channel.postMessage(JSON.stringify(message));
  }
}


function getId() {
  return (Math.random() + 1).toString(36).substring(7);
}


async function main() {
  let controller = null;

  let manager = new Manager({
    namespace: 'foo',
    listener: () => {
      console.log(manager.windows);

      let output = 'Windows:\n';
      output += Object.values(manager.windows)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((window) => {
          let out = '  - ' + window.id.toUpperCase();
          if (window.controlled) out += ' [controlled]';
          if (manager.self === window) out += ' [self]';
          if (manager.parent === window) out += ' [parent]';
          if (manager.children.has(window)) out += ' [child]';
          if (window.info.popup) out += ' [popup]';

          out += ` [state: ${window.data.state}]`;
          out += ` [screen: ${window.data.screenId}]`;

          if (window.controlled) {
            out += ` <button type="button" data-id="${window.id}">Close</button>`;
          }

          return out;
        })
        .join('\n');

      document.querySelector('pre').innerHTML = output;

      if (controller) {
        controller.abort();
      }

      controller = new AbortController();

      for (let el of document.querySelectorAll('button[data-id]')) {
        el.addEventListener('click', () => {
          let window = manager.windows[el.dataset.id];
          window.close();
        }, { signal: controller.signal });
      }
    }
  });

  window.manager = manager;

  await manager.start();

  document.querySelector('button').addEventListener('click', () => {
    manager.open();
  });

  document.querySelector('button:nth-child(2)').addEventListener('click', () => {
    manager.open({ popup: true });
  });
}

main().catch((err) => {
  console.error(err);
});
