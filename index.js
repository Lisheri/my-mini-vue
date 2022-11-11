/* // mini-vue
// 响应式概念, 依赖于 @vue/reactivity
import { ref, effect } from './node_modules/@vue/reactivity/dist/reactivity.esm-browser.js'

const a = ref(10);
let b = 0;
// effect函数会直接执行
effect(() => {
  // 依赖收集
  // + 此时执行a.value会触发a的依赖收集(get操作)
  b = a.value + 10;
  console.info(b);
})

// 派发更新
// + 触发set操作后, 会再次执行effect回调
a.value = 20;
 */

import { effectWatch, reactive } from './core/index.js';

const a = new Dep(10);
let b = 0;
effectWatch(() => {
  b = a.value + 10;
  console.info(b);
});
const user = reactive({
  name: '张三'
})
effectWatch(() => {
  const name = user.name + '的爹'
  console.info(name)
})

user.name = '李四'
a.value = 20;
