# Window manager

```js
let manager = new WindowManager();
manager.start(() => {
  // Called on every update

  console.log(this.windows);

  window.controlled
  window.state
  window.close();
});
```
