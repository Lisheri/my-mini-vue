import { baseCompile } from '@mini-vue/compiler-core';
import { registerRuntimeCompiler } from '@mini-vue/runtime-core';
import * as runtimeDom from '@mini-vue/runtime-dom';
import { isString, NOOP } from '@mini-vue/shared';
import type {
  RenderFunction,
  InternalRenderFunction
} from '@mini-vue/runtime-core';

// 编译缓存
const compileCache: Record<string, RenderFunction> = Object.create(null);

function compileToFunction(template: string | HTMLElement) {
  if (!isString(template)) {
    if (template.nodeType) {
      template = template.innerHTML;
    } else {
      console.warn(`不合理的template选项: `, template);
      return NOOP;
    }
  }

  // 添加缓存操作
  const key = template;
  const cached = compileCache[key];
  if (cached) {
    return cached;
  }

  const { code } = baseCompile(template);
  // const tst = new Function(code)();
  const render = new Function('vue', code)(runtimeDom) as RenderFunction;

  // 标识当前render为 runtime-compile 出来的
  (render as InternalRenderFunction)._rc = true;

  return (compileCache[key] = render);
}

// 注册编译函数
registerRuntimeCompiler(compileToFunction);

export { compileToFunction as compile };
// mini-vue出口
export * from '@mini-vue/runtime-dom';
