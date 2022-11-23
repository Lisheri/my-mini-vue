import { createRenderer, Renderer, RootRenderFunction } from '@mini-vue/runtime-core';
import { nodeOps } from './nodeOps';
import { patchProp, forcePatchProp } from './patchProp';
import { extend } from '@mini-vue/shared';

// 渲染器
let renderer: Renderer<Element>;

// 渲染相关的一些配置, 比如更新属性的方法, 操作DOM的方法
const rendererOptions = extend({ patchProp, forcePatchProp }, nodeOps);

function ensureRenderer() {
  return (
    renderer || (renderer = createRenderer<Node, Element>(rendererOptions))
  );
}

export const render = ((...args) => {
  ensureRenderer().render(...args);
}) as RootRenderFunction<Element>;
