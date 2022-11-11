import { effectWatch, reactive } from './core/index.js';
// const context = reactive({
//   count: 0
// });


const App = {
  render(context) {
    effectWatch(() => {
      // + 1. 优化
      // + 2. 跨平台的问题
      document.querySelector("#app").textContent = '';
      const element = document.createElement('div');
      const text = document.createTextNode('fuck you');
      const text1 = document.createTextNode(context.users.count);
      element.append(text);
      element.append(text1);
      document.querySelector("#app").append(element);
    });
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

App.render(App.setup());

// window.context = context;
