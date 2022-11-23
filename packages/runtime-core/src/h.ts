import { createVNode, isVNode } from './vnode';
import { isArray, isObject } from '@mini-vue/shared';

// h函数
export function h(type: any, propsOrChildren?: any, children?: any) {
  const argsLen = arguments.length;
  // 处理参数差异
  if (argsLen === 2) {
    // 仅两个参数时, 可能没有children, 也可能没有props
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      // 是对象不是数组, 说明没有children或者children只有一个
      if (isVNode(propsOrChildren)) {
        // 内部只有一个节点
        return createVNode(type, null, [propsOrChildren]);
      }
      return createVNode(type, propsOrChildren)
    } else {
      // 只有children, 没有props
      return createVNode(type, null, propsOrChildren)
    }
  } else {
    if (argsLen > 3) {
      // 从第三位开始所有参数作为children
      children = Array.prototype.slice.call(arguments, 2);
    } else if (argsLen === 3 && isVNode(children)) {
      // 单个vnode节点
      children = [children];
    }
    // 处理完差异后直接创建vnode
    return createVNode(type, propsOrChildren, children);
  }
}
