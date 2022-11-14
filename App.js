import { reactive, h } from './core/index.js';
export default {
  render(context) {
    // + 1. 优化, 对比节点变更, 更新对应节点
    // + 2. 跨平台的问题
    /* const element = document.createElement('div');
    const text = document.createTextNode('fuck you');
    const text1 = document.createTextNode(context.users.count);
    element.append(text);
    element.append(text1);
    return element; */
    return h("div", { id: "FuckFather", class: "gan" }, [
      h("p", { id: 'fuck' }, "nihao"),
      h("p", {}, context.users.count)
    ]);
  },
  setup() {
    const users = reactive({
      count: 1
    });
    window.users = users;
    return {
      users
    };
  }
};