import { RendererOptions } from '@mini-vue/runtime-core';

// dom操作
export const nodeOps: Omit<RendererOptions<Node, Element>, 'patchProp'> = {
  
} as any;
