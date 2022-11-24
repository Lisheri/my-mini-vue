import { RendererOptions } from '@mini-vue/runtime-core';

// dom操作
export const nodeOps: Omit<RendererOptions<Node, Element>, 'patchProp'> = {
  createElement: (tag, is): Element =>
    document.createElement(tag, is ? { is } : undefined),
  setText: (node, text) => {
    node.nodeValue = text;
  },
  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor || null);
  },
  createText: (text) => document.createTextNode(text),
  createComment: (text) => document.createComment(text),
  setElementText: (el, text) => {
    el.textContent = text;
  }
} as any;
