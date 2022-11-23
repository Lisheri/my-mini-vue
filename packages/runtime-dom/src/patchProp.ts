import { RendererOptions } from '@mini-vue/runtime-core';
type DOMRendererOptions = RendererOptions<Node, Element>;

export const forcePatchProp: DOMRendererOptions['forcePatchProp'] = (_, key) =>
  key === 'value';
export const patchProp: DOMRendererOptions['patchProp'] = () => {};
