import { Manager } from '../lib/index.js';


async function main() {
  let controller = null;

  let manager = new Manager({
    data: { age: 0 },
    info: { date: Date.now() }
  });

  let ids = [];

  manager.onUpdate(() => {
    // console.log('Update');

    let output = 'Nodes:\n';
    output += manager.nodes
      .sort((a, b) => a.info.date - b.info.date)
      .map((node) => {
        let index = ids.indexOf(node.id);

        if (index < 0) {
          index = ids.length;
          ids.push(node.id);
        }

        let out = `  <b>* Node ${node.id.toUpperCase()}</b>`;
        out += `\n    Created: ${new Date(node.info.date)}`;
        out += `    <button type="button" data-index="${index}" ${node.controlled ? '' : 'disabled'}>Close</button>`;
        out += `\n    Age: ${node.data.age}`;
        out += `\n    Screen: ${node.screen ? `${node.screen.label} (${node.screen.width} x ${node.screen.height})` : 'unknown'}`;

        out += '\n    ' + Object.entries({
          'Self': manager.self === node,
          'Popup': node.popup,
          'Controlled': node.controlled,
          'Focused': node.focused,
          'Visible': node.visible
        })
          .map(([key, value]) => `[${value ? 'x' : ' '}] ${key}`)
          .join('    ');

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

  setInterval(() => {
    manager.self.setData({ age: manager.self.data.age + 1 });
  }, 1000);
}

main().catch((err) => {
  console.error(err);
});
