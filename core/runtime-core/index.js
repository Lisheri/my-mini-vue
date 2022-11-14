import { effectWatch } from '../reactivity/index.js'
import { mountElement } from '../render.js';
export function createApp(rootComponent) {
  // 返回App
  return {
    mount(rootContainer) {
      const setupResult = rootComponent.setup();
      // render -> effectWatch
      // effectWatch -> render
      // 此处执行 effectWatch会先给currentEffect 设置为当前effect函数, 容纳后执行回调, 内部触发render方法
      // render过程中会访问users.count的get, 执行依赖收集
      effectWatch(() => {
        document.querySelector("#app").textContent = '';
        const subTree = rootComponent.render(setupResult);
        console.info(subTree);
        // - 转换真实DOM
        mountElement(subTree, rootContainer);
        // document.querySelector("#app").append(element);
      })
    }
  }
}