import {
  createVNode,
  Fragment,
  isVNode,
  VNode,
  VNodeArrayChildren,
  VNodeProps
} from './vnode';
import { isArray, isObject } from '@mini-vue/shared';
import { RawSlots } from './componentSlots';
import { EmitsOptions } from './componentEmits';
import { Component, ConcreteComponent, FunctionalComponent } from './component';

type RawProps = VNodeProps & {
  // 单个vnode作为children使用
  __v_isVNode?: never;
  // 数组vnode children
  [Symbol.iterator]?: never;
} & Record<string, any>;

type RawChildren =
  | string
  | number
  | boolean
  | VNode
  | VNodeArrayChildren
  | (() => any);

// 系列重载
// TODO 未处理 teleport suspense defineComponent
// element
export function h(type: string, children?: RawChildren): VNode;
export function h(
  type: string,
  props?: RawProps | null,
  children?: RawChildren | RawSlots
): VNode;

// fragment
export function h(type: typeof Fragment, children?: VNodeArrayChildren): VNode;
export function h(
  type: typeof Fragment,
  props?: RawProps | null,
  children?: VNodeArrayChildren
): VNode;

// functional component
export function h<P, E extends EmitsOptions = {}>(
  type: FunctionalComponent<P, E>,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren | RawSlots
): VNode;

// 所有通用组件
export function h(type: Component, children?: RawChildren): VNode;

// 具体组件
export function h<P>(
  type: ConcreteComponent | string,
  children?: RawChildren
): VNode;
export function h<P>(
  type: ConcreteComponent<P> | string,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren
): VNode;

// 没有props的组件
export function h(
  type: Component,
  props: null,
  children?: RawChildren | RawSlots
): VNode;
// h函数 本体
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
      return createVNode(type, propsOrChildren);
    } else {
      // 只有children, 没有props
      return createVNode(type, null, propsOrChildren);
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
