# window-manager

**window-manager** is a package for managing tabs, windows and screens.

Features:

- Share constant or variable information with other tabs
- Get status information on other tabs
- Handle screens with the Screen Management API (when supported)
- Create locks

Communication is achieved using `BroadcastChannel`.


## Usage

```js
import { Manager } from 'window-manager';


let manager = new Manager({
  // 'info' denotes constant information of this node
  info: { title: document.title },

  // 'data' denotes variable information of this node
  data: {},

  methods: {
    alert(message) {
      window.alert(message);
    }
  }
});

// Advertise this node and query the screen control API
manager.start();

// Call methods
manager.methods.alert('Hello');

// Reference to nodes (i.e. other tabs)
manager.self
manager.nodes
manager.orphanNodes

// Constant information
node.info
node.controlled
node.popup

// Variable information
node.data
node.focused
node.screen
node.visible
node.parent
node.fullscreen

// Other
node.children

// Listen for changes
manager.onUpdate(() => {
  // Called when a node is added, removed, or its data changes
});

node.onUpdate(() => {
  // Called when the node's data changes
});

// Create changes
node.setData({
  // Shallow merge
});

node.close();

// Control screens (only works when called after user interaction)
await manager.controlScreens();
```
