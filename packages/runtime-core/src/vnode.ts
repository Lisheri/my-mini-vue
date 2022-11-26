import { isProxy, ReactiveFlags, Ref, toRaw } from '@mini-vue/reactivity';
import {
  Component,
  ClassComponent,
  Data,
  ComponentInternalInstance
} from './component';
import { AppContext } from './apiCreateApp';
import { RendererNode, RendererElement } from './renderer';
import { RawSlots } from './componentSlots';
import { normalizeClass, normalizeStyle } from './normalizeProp';
import { ShapeFlags } from './shapeFlags';
import { currentRenderingInstance } from './componentRenderContext';
import {
  isArray,
  extend,
  isOn,
  isFunction,
  isString,
  isObject,
  SlotFlags
} from '@mini-vue/shared';
export interface VNode<
  HostNode = RendererNode,
  HostElement = RendererElement,
  ExtraProps = { [key: string]: any }
> {
  /**
   * @internal
   */
  __v_isVNode: true;
  /**
   * @internal
   */
  [ReactiveFlags.SKIP]: true;
  // 只有根节点有此属性
  appContext: AppContext | null;
  // 类型
  type: VNodeTypes;
  // 唯一键, 用于标识更新前后为相似节点
  key: string | number | null;
  // 快速确定节点类型
  shapeFlag: number;
  // 组件实例
  component: ComponentInternalInstance | null;
  // 儿子们
  children: VNodeNormalizedChildren;
  props: (VNodeProps & ExtraProps) | null;

  // DOM相关
  el: HostNode | null;
  // 锚点
  anchor: HostNode | null;
}

type VNodeChildAtom =
  | VNode
  | string
  | number
  | boolean
  | null
  | undefined
  | void;

export type VNodeArrayChildren = Array<VNodeArrayChildren | VNodeChildAtom>;

export type VNodeChild = VNodeChildAtom | VNodeArrayChildren;

// 文本节点
export const Text = Symbol('Text');
// 注释节点
export const Comment = Symbol('Comment');

export type VNodeTypes =
  | string
  | VNode
  | Component
  | typeof Text
  | typeof Comment;

export type VNodeNormalizedChildren =
  | string
  | VNodeArrayChildren
  | RawSlots
  | null;

// mount钩子
type VNodeMountHook = (vnode: VNode) => void;
// update钩子
type VNodeUpdateHook = (vnode: VNode, oldVNode: VNode) => void;
export type VNodeHook =
  | VNodeMountHook
  | VNodeUpdateHook
  | VNodeMountHook[]
  | VNodeUpdateHook[];

export type VNodeRef =
  | string
  | Ref
  | ((ref: object | null, refs: Record<string, any>) => void);
// vnodeProps类型定义
export type VNodeProps = {
  key?: string | number;
  ref?: VNodeRef;
  // vnode用钩子
  onVnodeBeforeMount?: VNodeMountHook | VNodeMountHook[];
  onVnodeMounted?: VNodeMountHook | VNodeMountHook[];
  onVnodeBeforeUpdate?: VNodeUpdateHook | VNodeUpdateHook[];
  onVnodeUpdated?: VNodeUpdateHook | VNodeUpdateHook[];
  onVnodeBeforeUnmount?: VNodeMountHook | VNodeMountHook[];
  onVnodeUnmounted?: VNodeMountHook | VNodeMountHook[];
};

// 消除undefined带来的类型推断错误
const normalizeKey = ({ key }: VNodeProps): VNode['key'] =>
  key != null ? key : null;

export function cloneVNode<T, U>(
  vnode: VNode<T>, // vnode本身
  extraProps?: (Data & VNodeProps) | null // 额外的属性
  // TODO mergeRef = false 还需要处理ref的合并, 尤其是vnode本身具有ref, 同时他还要被设置到多个refs上
): VNode {
  const { props, children } = vnode;
  const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props;
  return {
    __v_isVNode: true,
    [ReactiveFlags.SKIP]: true,
    appContext: vnode.appContext,
    type: vnode.type,
    props: mergedProps,
    key: mergedProps && normalizeKey(mergedProps),
    children: isArray(children)
      ? (children as VNode[]).map(deepCloneVNode)
      : children,
    shapeFlag: vnode.shapeFlag,
    component: vnode.component,
    el: vnode.el,
    anchor: vnode.anchor
  } as VNode;
}

const deepCloneVNode = (vnode: VNode): VNode => {
  const cloned = cloneVNode(vnode);
  if (isArray(cloned.children)) {
    // 递归调用cloneVNode
    cloned.children = (cloned.children as VNode[]).map(deepCloneVNode);
  }
  return cloned;
};

// TODO 暂不考虑动态组件
export function createVNode(
  type: VNodeTypes | ClassComponent,
  props: (Data & VNodeProps) | null = null,
  children: unknown = null
): VNode {
  if (!type) {
    console.warn(`创建vnode时, vnode的类型不合法: ${type}`);
  }
  if (isVNode(type)) {
    // TODO 这里其实就需要对ref进行合并, 但这里暂不考虑, 后续再补充
    const cloned = cloneVNode(type, props);
    if (children) {
      normalizeChildren(cloned, children);
    }
  }

  // TODO 暂不考虑类组件

  if (props) {
    // 处理props, 标准化class和style
    if (isProxy(props)) {
      props = extend({}, props);
    }
    let { class: kclass, style } = props;
    if (kclass && !isString(kclass)) {
      // 处理非string类型的class
      props.class = normalizeClass(kclass);
    }
    if (isObject(style)) {
      // 响应式类型的style需要浅拷贝一次, 防止被修改(可能和响应式变量指针指向同一地址)
      if (isProxy(style) && !isArray(style)) {
        style = extend({}, style);
      }
      props.style = normalizeStyle(style);
    }
  }

  // 处理vnode信息, 对齐shapeFlag
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : isObject(type)
    ? ShapeFlags.STATEFUL_COMPONENT
    : isFunction(type)
    ? ShapeFlags.FUNCTIONAL_COMPONENT
    : 0;

  if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT && isProxy(type)) {
    type = toRaw(type);
    console.warn(`组件: ${String(type)} 不应该被处理为响应式对象`);
  }

  // 创建vnode对象
  const vnode: VNode = {
    __v_isVNode: true,
    [ReactiveFlags.SKIP]: true,
    el: null,
    props,
    component: null,
    key: props && normalizeKey(props),
    type,
    children: null,
    appContext: null,
    anchor: null,
    shapeFlag
  };

  if (vnode.key !== vnode.key) {
    console.warn(`vnode: ${String(vnode.type)}上的key是一个NaN`);
  }

  // 标准化子节点, 把不同数据类型的children转成数组或文本类型
  normalizeChildren(vnode, children);

  return vnode;
}

export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  // 类型和key均相同则认为是相似节点(非相同, 而是指更新前后为同一个节点)
  return n1.type === n2.type && n1.key === n2.key;
}

// 判断节点是否为虚拟节点
export const isVNode = (target: any): target is VNode =>
  target ? target.__v_isVNode === true : false;

export function normalizeVNode(child: VNodeChild): VNode {
  if (child == null || typeof child === 'boolean') {
    // 两者都表示传入的节点有问题
    return createVNode(Comment);
  } else if (isArray(child)) {
    // TODO 处理Fragment
    console.warn('暂不支持fragment');
    return createVNode(Comment);
  } else if (typeof child === 'object') {
    // 处理编译产生的vnode, 通过判断 el 是否存在来判断编译产生的 vnode 是不是一个标准的 vnode, 如果不是则调用cloneVNode转换为标准vnode
    // ? 编译可能会产生vnode子数组
    return child.el === null ? child : cloneVNode(child);
  } else {
    // 数字或者字符串直接创建文本节点
    return createVNode(Text, null, String(child));
  }
}

export function normalizeChildren(vnode: VNode, children: unknown) {
  let type = 0;
  const { shapeFlag } = vnode;
  if (children == null) {
    // 过滤undefined
    children = null;
  } else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN;
  } else if (typeof children === 'object') {
    if (shapeFlag & ShapeFlags.ELEMENT) {
      const slot = (children as any).default;
      if (slot) {
        normalizeChildren(vnode, slot());
      }
      return;
    } else {
      // ? shapeFlag不是element, 但是children是个对象, 那么说明传递的是插槽配置
      // 处理儿子中的插槽
      type = ShapeFlags.SLOTS_CHILDREN;
      const slotFlag = (children as RawSlots)._; // 获取当前children的slotFlag(组件更新阶段已经有了)
      if (!slotFlag) {
        // 挂载阶段
        // 保留当前组件的instance
        (children as RawSlots)._ctx = currentRenderingInstance;
      } else if (
        slotFlag === SlotFlags.FORWARDED &&
        currentRenderingInstance
      ) {
        // 更新阶段判断当前插槽是否需要强制子组件更新
        // 子组件从父组件接收转发的插槽。它的插槽类型由其父级的插槽类型决定。
        // TODO 此处需要根据当前实例的patchFlag来决定, 暂不实现patchFlag, 因此暂时均设置为动态插槽, 强制子组件去更新
        (children as RawSlots)._ = SlotFlags.DYNAMIC;
      }
    }
  } else if (isFunction(children)) {
    children = { default: children, _ctx: currentRenderingInstance };
    type = ShapeFlags.SLOTS_CHILDREN;
  } else {
    children = String(children);
    type = ShapeFlags.TEXT_CHILDREN;
  }
  vnode.children = children as VNodeNormalizedChildren;
  vnode.shapeFlag |= type;
}

export function mergeProps(...args: (Data & VNodeProps)[]) {
  const ret = extend({}, args[0]);
  // 对来源props进行标准化
  for (let i = 1; i < args.length; i++) {
    const toMerge = args[i];
    for (const key in toMerge) {
      if (key === 'class') {
        if (ret.class !== toMerge.class) {
          // 标准化class
          ret.class = normalizeClass([ret.class, toMerge.class]);
        }
      } else if (key === 'style') {
        ret.style = normalizeStyle([ret.style, ret.style]);
      } else if (isOn(key)) {
        // 处理事件, 事件的key以on开头
        const existing = ret[key];
        const incoming = toMerge[key];
        if (existing !== incoming) {
          ret[key] = existing
            ? [].concat(existing as any, toMerge as any)
            : incoming;
        }
      } else if (key !== '') {
        ret[key] = toMerge[key];
      }
    }
  }
  return ret;
}
