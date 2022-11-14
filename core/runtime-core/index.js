import { effectWatch } from '../reactivity/index.js'
import { mountElement, diff } from '../render.js';
export function createApp(rootComponent) {
  // 返回App
  return {
    mount(rootContainer) {
      const setupResult = rootComponent.setup();
      let prevSubTree = null;
      let isMounted = false;
      // render -> effectWatch
      // effectWatch -> render
      // 此处执行 effectWatch会先给currentEffect 设置为当前effect函数, 容纳后执行回调, 内部触发render方法
      // render过程中会访问users.count的get, 执行依赖收集
      effectWatch(() => {
        if (!isMounted) {
          // init
          isMounted = true;
          const subTree = rootComponent.render(setupResult);
          prevSubTree = subTree
          mountElement(subTree, rootContainer);
        } else {
          // update
          const subTree = rootComponent.render(setupResult);
          console.info(prevSubTree, subTree);
          // - diff更新
          diff(prevSubTree, subTree);
          prevSubTree = subTree
        }
        // document.querySelector("#app").textContent = '';
        // const subTree = rootComponent.render(setupResult);
        // - 转换真实DOM
        // mountElement(subTree, rootContainer);
        // document.querySelector("#app").append(element);
      })
    }
  }
}