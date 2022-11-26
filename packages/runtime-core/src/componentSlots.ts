import {
  VNode,
  VNodeNormalizedChildren,
  normalizeVNode,
  VNodeChild
} from './vnode';
import { ComponentInternalInstance, currentInstance } from './component';
import { SlotFlags, isFunction, isArray } from '@mini-vue/shared';
import { ShapeFlags } from './shapeFlags';
import { withCtx } from './componentRenderContext';
export type Slot = (...args: any[]) => VNode[];

export type InternalSlots = {
  [name: string]: Slot | undefined;
};

export type Slots = Readonly<InternalSlots>;
export type RawSlots = {
  [name: string]: unknown;
  // 是否需要提示渲染函数跳过子组件强制更新
  $stable?: boolean;
  // 当前组件实例
  // ? 在patch过程中用于追踪所有者, 同时在创建vnode时标准化children
  _ctx?: ComponentInternalInstance | null;
  // 插槽类型
  // ? 通过compile生成的插槽使用的是保留属性而不是vnode patchFlags, 因为插槽在render函数中会直接传递给子组件并且会根据不同的类型来要求渲染函数跳过子组件更新
  _?: SlotFlags;
};

const normalizeSlotValue = (value: unknown): VNode[] =>
  isArray(value)
    ? value.map(normalizeVNode)
    : [normalizeVNode(value as VNodeChild)];

const normalizeSlot = (
  key: string,
  rawSlot: Function,
  ctx: ComponentInternalInstance | null | undefined
): Slot => {
  return withCtx((props: any) => {
    if (currentInstance) {
      // 插槽正在渲染函数或setup中被调用, 此时关闭了依赖收集, 不会收集依赖
      console.warn(
        `插槽: ${key}正在渲染函数之外阶段被调用, 此时无法追踪依赖项, 会导致插槽无法更新, 滚去渲染函数中用`
      );
    }
    // 标准化插槽返回结果, 可能是一个 Array<VNode>, 也可能直接就是VNode
    return normalizeSlotValue(rawSlot(props));
  }, ctx) as Slot;
};

// 是否为插槽的属性
const isInternalKey = (key: string) => key?.[0] === '_' || key === '$stable';

/**
 * 标准化对象插槽
 * @param rawSlots 当前节点的children
 * @param slots 当前实例的插槽对象
 */
const normalizeObjectSlots = (rawSlots: RawSlots, slots: InternalSlots) => {
  const ctx = rawSlots._ctx;
  for (const key in rawSlots) {
    if (isInternalKey(key)) continue;
    const value = rawSlots[key];
    if (isFunction(value)) {
      // 处理作用域插槽
      // 传递了一个渲染函数, 需要标准化为插槽属性
      slots[key] = normalizeSlot(key, value, ctx);
    } else if (value != null) {
      // 插槽直接传递了vnode
      // 具名插槽
      const normalized = normalizeSlotValue(value);
      slots[key] = () => normalized;
    }
  }
};

// 标准化VNode插槽
const normalizeVNodeSlots = (
  instance: ComponentInternalInstance,
  children: VNodeNormalizedChildren
) => {
  const normalized = normalizeSlotValue(children);
  // 默认插槽
  instance.slots.default = () => normalized;
};

/**
 * 初始化slots
 * @param instance 当前组件实例
 * @param children 当前组件的内部元素/组件们
 */
export function initSlots(
  instance: ComponentInternalInstance,
  children: VNodeNormalizedChildren
) {
  if (instance.vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    // 获取插槽类型
    const type = (children as RawSlots)._;
    if (type) {
      // type存在说明在normalizedChildren时已处理过, 且children是个插槽
      instance.slots = children as InternalSlots;
    } else {
      // 具名插槽和作用域插槽
      normalizeObjectSlots(children as RawSlots, (instance.slots = {}));
    }
  } else {
    // 处理默认插槽
    instance.slots = {};
    if (children) {
      normalizeVNodeSlots(instance, children);
    }
  }
}
