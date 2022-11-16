import { isObject, toRawType, def } from '@mini-vue/shared';
import { UnwrapRef, Ref } from './ref';
import { mutableHandlers } from './baseHandlers';

type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRef<T>;

export const reactiveMap = new WeakMap<Target, any>();

export const enum ReactiveFlags {
  // 不做响应式处理
  SKIP = '__v_skip',
  // 判断对象是否已经有对应的响应式对象, 此时target是原始对象
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly',
  // 判断对象是不是一个响应式对象(Proxy对象), 此时target就是Proxy对象
  RAW = '__v_raw'
}

export interface Target {
  [ReactiveFlags.SKIP]?: boolean;
  [ReactiveFlags.IS_REACTIVE]?: boolean;
  [ReactiveFlags.IS_READONLY]?: boolean;
  [ReactiveFlags.RAW]?: any;
}

// 重载, 支持泛型
export function reactive<T extends object>(target: T): UnwrapNestedRefs<T>;
export function reactive(target: object) {
  // 如果将一个 readonly proxy 对象变成响应式，直接返回这个对象即可
  if (target && target[ReactiveFlags.IS_READONLY]) {
    return target;
  }
  return createReactiveObject(target, mutableHandlers);
}

function createReactiveObject(
  target: Target,
  // 基本reactive响应式对象的劫持属性
  baseHandlers
) {
  if (!isObject(target)) {
    console.warn(`当前值不能作为reactive响应式对象: ${String(target)}`);
    return target;
  }
  const proxyMap = reactiveMap;
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    // target 已经有对应的 Proxy, 直接返回当前Proxy
    return existingProxy
  }
  const proxy = new Proxy(target, baseHandlers);
  proxyMap.set(target, proxy);
  return proxy;
}

// 将响应式对象还原为原始对象
export function toRaw<T>(observed: T): T {
  return (
    // 这里递归一次, 来看 observed 是否是一个响应式对象, 非响应式对象没有 __v_raw属性, 该属性指向原对象
    (observed && toRaw((observed as Target)[ReactiveFlags.RAW])) || observed
  );
}
