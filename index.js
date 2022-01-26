import { Manager } from './lib/index.js';


async function main() {
  let controller = null;

  let manager = new Manager({
    data: { timestamp: 0 },
    info: { date: Date.now() }
  });

  let ids = [];

  manager.onUpdate(() => {
    // console.log('Update');

    let output = 'Nodes:\n';
    output += manager.nodeList
      // .sort((a, b) => a.id.localeCompare(b.id))
      .sort((a, b) => a.info.date - b.info.date)
      .map((node) => {
        let index = ids.indexOf(node.id);

        if (index < 0) {
          index = ids.length;
          ids.push(node.id);
        }

        let out = `  * Created: ${new Date(node.info.date)}`;
        out += `    <button type="button" data-index="${index}" ${node.controlled ? '' : 'disabled'}>Close</button>`;
        out += `\n    Timestamp: ${node.data.timestamp}`;
        out += `\n    Screen: ${node.screen ? `${node.screen.label} (${node.screen.width} x ${node.screen.height})` : 'unknown'}`;

        out += '\n    ' + Object.entries({
          'Self': manager.self === node,
          'Popup': node.popup,
          'Controlled': node.controlled,
          'Focused': node.focused,
          'Visible': node.visible
        })
          // .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([key, value]) => `[${value ? 'x' : ' '}] ${key}`)
          .join('    ');

        // out += ` [state: ${node.data.state}]`;
        // out += ` [screen: ${node.data.screenId}]`;

        // if (node.controlled) {
        // }

        out += '\n';

        return out;
      })
      .join('\n');

    document.querySelector('pre').innerHTML = output;

    if (controller) {
      controller.abort();
    }

    controller = new AbortController();

    for (let el of document.querySelectorAll('button[data-index]')) {
      let index = el.dataset.index;

      el.addEventListener('click', () => {
        let id = ids[index];
        let node = manager.nodes[id];
        node.close();
      }, { signal: controller.signal });
    }
  }, { initial: true });


  await manager.start();
  window.manager = manager;


  document.querySelector('button').addEventListener('click', () => {
    manager.open();
  });

  document.querySelector('button:nth-child(2)').addEventListener('click', () => {
    manager.open({ popup: true });
  });

  document.querySelector('button:nth-child(3)').addEventListener('click', () => {
    // manager.controlScreens();
    window.getScreenDetails();
  });

  // setInterval(() => {
  //   manager.self.setData({ timestamp: manager.self.data.timestamp + 1 });
  // }, 1000);
}

main().catch((err) => {
  console.error(err);
});
