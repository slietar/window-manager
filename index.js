class Manager {
  constructor(options = {}) {
    this._channel = new BroadcastChannel(options.channelName ?? 'window-control');
    this._listener = options.listener;

    this.windows = {};
    this.self = this._newWindow({
      id: options.id ?? getId(),
      controlled: window.opener !== null,
      ref: window
    });

    this.children = new Set();

    this._childrenRefs = [];
    this._update();

    document.title = this.self.id.toUpperCase();
  }

  _newWindow(options) {
    let that = this;

    let win = {
      parentId: null,
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
        return that.windows[win.parentId];
      }
    };

    this.windows[win.id] = win;
    return win;
  }

  _update() {
    requestAnimationFrame(() => {
      this._listener?.();
    });
  }


  get parent() {
    return this.self.parent;
  }

  open(options = {}) {
    let ref = window.open(location.href, '', '');
    this._childrenRefs.push(ref);
  }

  start() {
    window.__info = this.self;

    if (window.opener) {
      let parent = this._newWindow(window.opener.__info);
      this.self.parentId = parent.id;
    }

    this._channel.addEventListener('message', (event) => {
      let message = JSON.parse(event.data);

      switch (message.type) {
        case 'declare': {
          let window = this._newWindow(message.window);

          if (window.parent === this.self) {
            this.children.add(window);
          }

          this._channelSend({
            type: 'info',
            windows: Object.values(this.windows).map((window) => ({
              id: window.id,
              controlled: window.controlled,
              parentId: window.parent?.id ?? null
            }))
          });

          this._update();

          break;
        }
        case 'info': {
          let update = false;

          for (let window of message.windows) {
            if (!(window.id in this.windows)) {
              this._newWindow(window);
              update = true;
            }
          }

          if (update) {
            this._update();
          }

          break;
        }
        case 'close': {
          let closedWindow = this.windows[message.id];
          delete this.windows[closedWindow.id];

          for (let window of Object.values(this.windows)) {
            if (window.parentId === closedWindow.id) {
              window.parentId = null;
            }
          }

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
      }
    });

    window.addEventListener('beforeunload', (event) => {
      this._channelSend({
        type: 'close',
        id: this.self.id
      });
    });

    this._channelSend({
      type: 'declare',
      window: {
        id: this.self.id,
        controlled: this.self.controlled,
        parentId: this.parent?.id ?? null
      }
    });
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
      console.log(manager.windows, manager.parent, manager.children);

      let output = 'Windows:\n';
      output += Object.values(manager.windows)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((window) => {
          let out = '  - ' + window.id.toUpperCase();
          if (window.controlled) out += ' [controlled]';
          if (manager.self === window) out += ' [self]';
          if (manager.parent === window) out += ' [parent]';
          if (manager.children.has(window)) out += ' [child]';

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

  manager.start();

  document.querySelector('button').addEventListener('click', () => {
    manager.open();
  });
}

main().catch((err) => {
  console.error(err);
});
