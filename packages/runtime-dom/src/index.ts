import { createRenderer, Renderer, RootRenderFunction, CreateAppFunction } from '@mini-vue/runtime-core';
import { nodeOps } from './nodeOps';
import { patchProp, forcePatchProp } from './patchProp';
import { extend, isString } from '@mini-vue/shared';

// 渲染器
let renderer: Renderer<Element>;

// 渲染相关的一些配置, 比如更新属性的方法, 操作DOM的方法
const rendererOptions = extend({ patchProp, forcePatchProp }, nodeOps);

function ensureRenderer() {
  return (
    renderer || (renderer = createRenderer<Node, Element>(rendererOptions))
  );
}


// 处理挂载点
const normalizeContainer = (container: Element | string): Element | null => {
  if (isString(container)) {
    const res = document.querySelector(container);
    if (!res) {
      console.warn(`找不到挂载点${container}`);
    }
    return res;
  }
  return container as (Element | null);
}

export const render = ((...args) => {
  ensureRenderer().render(...args);
}) as RootRenderFunction<Element>;

// dom入口
export const createApp = ((...args) => {
  const app = ensureRenderer().createApp(...args);
  const { mount } = app;
  // 重写mount
  app.mount = (containerOrSelector: Element | string): any => {
    const container = normalizeContainer(containerOrSelector);
    if (!container) return;
    // 挂载前清空容器内容
    container.innerHTML = '';
    debugger
    const proxy = mount(container);
    return proxy;
  }
  // TODO 这里需要重写mount
  return app
}) as CreateAppFunction<Element>

// h等公用函数导出
export * from '@mini-vue/runtime-core';
