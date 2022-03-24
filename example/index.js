import { Manager } from '../lib/index.js';


async function main() {
  let controller = null;

  let manager = new Manager({
    data: { age: 0 },
    info: { date: Date.now() }
  });

  manager.onUpdate(() => {
    // console.log('Update');

    let output = 'Nodes:\n';
    output += manager.nodes
      .sort((a, b) => a.info.date - b.info.date)
      .map((node) => {
        let out = `  <b>* Node ${node.id.toUpperCase()}</b>`;
        out += `\n    Created: ${new Date(node.info.date)}`;
        out += `    <button type="button" data-id="${node.id}" ${node.controlled ? '' : 'disabled'} data-role="close">Close</button>`;
        out += ` <button type="button" data-id="${node.id}" ${node.controlled && node.popup ? '' : 'disabled'} data-role="wholescreen">Whole screen</button>`;
        // out += `\n    Age: ${node.data.age}`;

        if (node.screen) {
          out += `\n    Screen: <select data-id="${node.id}" ${node.controlled && node.popup ? '' : 'disabled'}>${manager.screenDetails.screens.map((screen, screenIndex) => `<option ${screen === node.screen ? 'selected' : ''} value="${screenIndex}">${screen.label} (${screen.width} x ${screen.height})</option>`).join('')}</select>`;
        }

        out += '\n    ' + Object.entries({
          'Self': manager.self === node,
          'Popup': node.popup,
          'Controlled': node.controlled,
          'Focused': node.focused,
          'Fullscreen': node.fullscreen,
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

    for (let el of document.querySelectorAll('button[data-id][data-role="close"]')) {
      el.addEventListener('click', () => {
        let node = manager.nodesById[el.dataset.id];
        node.close();
      }, { signal: controller.signal });
    }

    for (let el of document.querySelectorAll('button[data-id][data-role="wholescreen"]')) {
      el.addEventListener('click', () => {
        let node = manager.nodesById[el.dataset.id];
        node.resizeTo(node.screen.width, node.screen.height);
      }, { signal: controller.signal });
    }

    for (let el of document.querySelectorAll('select[data-id]')) {
      el.addEventListener('change', () => {
        let node = manager.nodesById[el.dataset.id];
        let screen = manager.screenDetails.screens[el.value];

        node.moveToScreen(screen, 0, 0);
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
    window.getScreenDetails();
  });

  document.querySelector('button:nth-child(4)').addEventListener('click', () => {
    document.body.requestFullscreen();
  });

  // setInterval(() => {
  //   manager.self.setData({ age: manager.self.data.age + 5 });
  // }, 5000);
}

main().catch((err) => {
  console.error(err);
});
